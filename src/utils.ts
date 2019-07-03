import { WebSocketClient } from "./ws-autoreconnect";
import { Message } from "@taskforcesh/message-broker";

export interface ConnectOpts {
  host: string;
  token: string;
  connectionId: string;
  queueName: string;
}

export function connect<T>(
  { host, token, connectionId, queueName }: ConnectOpts,
  onMessage: (msg: Message<T>) => void,
  processOpts?: { concurrency: number }
): Promise<WebSocketClient> {
  const ws = new WebSocketClient();

  ws.open(
    `${host}/connections/${connectionId}/queues/${queueName}${
      processOpts ? `/process/${processOpts.concurrency}` : ""
    }`,
    {
      headers: {
        Authorization: "Bearer " + token,
        Taskforce: "connector"
      }
    }
  );

  ws.onopen = function open() {};

  return new Promise((resolve, reject) => {
    ws.onmessage = msg => {
      const { id, data } = JSON.parse(msg);
      if (data.type === "authorized" && id === "0") {
        return resolve(ws);
      }
      onMessage({ id, data });
    };

    ws.onclose = function close(err) {
      console.log("error", err);
      reject(err);
    };
  });
}

export function respond(ws: WebSocketClient, id: string, data: object) {
  ws.send(
    JSON.stringify({
      id,
      data
    })
  );
}
