import { Message, MessageBroker } from "@taskforcesh/message-broker";
import { Command, CommandTypes } from "@taskforcesh/queue-commands";
import { QueueEvent } from "./queue-event";
import { connect, ConnectOpts, respond } from "./utils";
import { WebSocketClient } from "./ws-autoreconnect";
import { Events } from "@taskforcesh/queue-commands";

interface WorkerOpts {
  connect: ConnectOpts;
  concurrency: number;
}

export class QueueWorker<K> extends QueueEvent<K> {
  private ws: WebSocketClient;
  private connecting: Promise<WebSocketClient>;
  private mb: MessageBroker<Command>;

  constructor(private opts: WorkerOpts) {
    super();
  }

  async process<T, Q = void>(processor: (job: T) => Promise<Q>) {
    if (this.connecting) {
      throw new Error("Can only define processor once");
    }
    this.connecting = connect(
      this.opts.connect,
      (msg: Message<Command>) => {
        const { id, data } = msg;
        if (data.type === CommandTypes.Process) {
          callProcessor(this.ws, id, data.payload, processor);
        } else {
          console.log(data);
          this.processEvent(data);
        }
      },
      { concurrency: this.opts.concurrency }
    );
    this.ws = await this.connecting;
  }

  async close() {
    const ws = await this.connecting;
    ws.close();
  }

  private async getMessageBroker() {
    const ws = await this.connecting;
    if (!this.mb) {
      this.mb = new MessageBroker(async (msg: string) => ws.send(msg));
    }
    return this.mb;
  }

  async on<M extends keyof Events>(event: M, listener: Events[M]) {
    const mb = await this.getMessageBroker();
    this.eventEmitter.on(event, listener);
    super.registerEvent(mb, event);
  }

  async off<M extends keyof Events>(event: M, listener: Events[M]) {
    const mb = await this.getMessageBroker();
    this.eventEmitter.off(event, listener);
    super.unregisterEvent(mb, event);
  }
}

type processorFunc = (job: any) => Promise<{}>;

async function callProcessor(
  ws: WebSocketClient,
  id: string,
  data: string,
  processor: processorFunc
) {
  try {
    const result = await processor({ data });
    respond(ws, id, result);
  } catch (err) {
    respond(ws, id, err);
  }
}
