import * as WebSocket from "ws";
import chalk from "chalk";
import { WebsocketError } from "./ws-errors.enum";

const HEARTBEAT_INTERVAL = 30000;

export class WebSocketClient {
  private number = 0; // Message number
  private autoReconnectInterval = 5 * 1000; // ms
  private url: string;
  private opts: object;
  private instance: any;
  private pingTimeout: NodeJS.Timeout;

  open(url: string, opts: object) {
    this.url = url;
    this.opts = opts;

    this.instance = new WebSocket(url, opts);
    this.instance.on("open", () => {
      // this.heartbeat();
      this.onopen();
    });

    this.instance.on("message", (data: string, flags: object) => {
      this.number++;

      // Hack for ping until uWS supports ping.
      if (data === "ping") {
        this.heartbeat();
      } else {
        this.onmessage(data, flags, this.number);
      }
    });

    this.instance.on("ping", () => this.heartbeat());

    this.instance.on(
      "close",
      (codeOrError: number | Error, reason?: string) => {
        clearTimeout(this.pingTimeout);

        switch (codeOrError) {
          case WebsocketError.NormalClosure:
            console.log(
              chalk.yellow("WebSocket:") + chalk.blue("normally closed")
            );
            break;

          case 4000:
            console.log(
              chalk.yellow("WebSocket:") + chalk.red(" Invalid authentication")
            );
            break;
          default:
            // Abnormal closure
            this.reconnect(<Error>codeOrError);
            break;
        }
        this.onclose(<Error>codeOrError, reason);
      }
    );
    this.instance.on("error", (err: any) => {
      switch (err["code"]) {
        case "ECONNREFUSED":
          break;
        default:
          this.onerror(err);
          break;
      }
    });
  }

  send(data: string, option?: object) {
    try {
      this.instance.send(data, option);
    } catch (err) {
      console.error(err);
      this.instance.emit("error", err);
    }
  }

  reconnect(err: Error) {
    var msg = err.message || "";
    console.log(
      chalk.yellow("WebSocket:") +
        chalk.red(` ${msg} retry in ${this.autoReconnectInterval}ms`)
    );
    this.instance.removeAllListeners();
    setTimeout(() => {
      console.log("WebSocket: reconnecting...");
      this.open(this.url, this.opts);
    }, this.autoReconnectInterval);
  }

  close() {
    this.instance && this.instance.close();
  }

  onopen() {
    console.log("WebSocket: open", arguments);
  }

  heartbeat() {
    clearTimeout(this.pingTimeout);

    this.pingTimeout = setTimeout(() => {
      this.instance.terminate();
    }, HEARTBEAT_INTERVAL);
  }

  onmessage = function(data: string, flags: object, num: number) {
    console.log("WebSocket: message", data, flags, num);
  };
  onerror = function(e: Error) {
    console.log("WebSocket: error", arguments);
  };
  onclose = function(err: Error, reason?: string) {
    console.log("WebSocket: closed", arguments);
  };
}
