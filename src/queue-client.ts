import Bull, { JobOptions, JobStatusClean } from "bull";
import { Message, MessageBroker } from "@taskforcesh/message-broker";
import {
  Command,
  CommandTypes,
  GetJobsMethod,
  GetJobsParams,
  CleanParams,
  JobsMethod,
  Events
} from "@taskforcesh/queue-commands";
import { connect, ConnectOpts } from "./utils";
import { WebSocketClient } from "./ws-autoreconnect";
import { Job } from "./job";
import { QueueEvent } from "./queue-event";

export class QueueClient<K> extends QueueEvent<K> {
  private ws: WebSocketClient;
  private connecting: Promise<WebSocketClient>;
  private mb: MessageBroker<Command>;

  constructor(private opts: ConnectOpts) {
    super();
  }

  private async send<T, Q = void>(data: Command<T>) {
    const mb = await this.getMessageBroker();
    return mb.sendData<Q>(data);
  }

  private async getMessageBroker() {
    if (!this.connecting) {
      this.connecting = connect(
        this.opts,
        (msg: Message<Command>) => {
          if (this.mb) {
            this.mb.processMessage(<Message<Command>>msg);
            this.processEvent(msg.data);
          }
        }
      );
    }
    if (!this.ws) {
      this.ws = await this.connecting;
      if (!this.mb) {
        this.mb = new MessageBroker(async (msg: string) => this.ws.send(msg));
      }
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

  async add(data: K, opts?: JobOptions) {
    return this.send<{ data: K; opts: JobOptions }, {}>({
      type: CommandTypes.Add,
      payload: {
        data,
        opts
      }
    });
  }

  async pause() {
    return this.send<void>({
      type: CommandTypes.Pause
    });
  }

  async resume() {
    return this.send<void>({
      type: CommandTypes.Resume
    });
  }

  async count(): Promise<number> {
    return this.send<void, number>({
      type: CommandTypes.Count
    });
  }

  async empty() {
    return this.send<void>({
      type: CommandTypes.Empty
    });
  }

  getJobLogs(
    jobId: string,
    start?: number,
    end?: number
  ): Promise<{
    logs: string[];
    count: number;
  }> {
    return this.send<
      { jobId: string; start: number; end: number },
      { logs: string[]; count: number }
    >({
      type: CommandTypes.GetJobLogs,
      payload: {
        jobId,
        start,
        end
      }
    });
  }

  getJobCounts(): Promise<Bull.JobCounts> {
    return this.send<void, Bull.JobCounts>({ type: CommandTypes.GetJobsCount });
  }

  getRepeatableJobs(
    start?: number,
    end?: number,
    asc?: boolean
  ): Promise<Array<Job<K>>> {
    return this.getJobs("getRepeatableJobs", start, end, asc);
  }

  getWaiting(
    start?: number,
    end?: number,
    asc?: boolean
  ): Promise<Array<Job<K>>> {
    return this.getJobs("getWaiting", start, end, asc);
  }

  getActive(
    start?: number,
    end?: number,
    asc?: boolean
  ): Promise<Array<Job<K>>> {
    return this.getJobs("getActive", start, end, asc);
  }

  getDelayed(
    start?: number,
    end?: number,
    asc?: boolean
  ): Promise<Array<Job<K>>> {
    return this.getJobs("getDelayed", start, end, asc);
  }

  getCompleted(
    start?: number,
    end?: number,
    asc?: boolean
  ): Promise<Array<Job<K>>> {
    return this.getJobs("getCompleted", start, end, asc);
  }

  getFailed(
    start?: number,
    end?: number,
    asc?: boolean
  ): Promise<Array<Job<K>>> {
    return this.getJobs("getFailed", start, end, asc);
  }

  getJobs(method: GetJobsMethod, start: number, end: number, asc: boolean) {
    return this.send<GetJobsParams, Job<K>[]>({
      type: CommandTypes.GetJobs,
      payload: {
        method,
        start,
        end,
        asc
      }
    });
  }

  clean(
    grace: number,
    status?: JobStatusClean,
    limit?: number
  ): Promise<number[]> {
    return this.send<CleanParams, number[]>({
      type: CommandTypes.Clean,
      payload: {
        grace,
        status,
        limit
      }
    });
  }

  //
  // Jobs
  //
  jobCommand(method: JobsMethod, jobId: string) {
    return this.send<{ method: JobsMethod; jobId: string }, void>({
      type: CommandTypes.JobsCommand,
      payload: {
        method,
        jobId
      }
    });
  }

  jobUpdate(jobId: string, data: {}) {
    return this.send<{ jobId: string; data: {} }, void>({
      type: CommandTypes.JobUpdate,
      payload: {
        jobId,
        data
      }
    });
  }

  jobProgress(jobId: string, progress: {}) {
    return this.send<{ jobId: string; progress: {} }, void>({
      type: CommandTypes.JobUpdate,
      payload: {
        jobId,
        progress
      }
    });
  }

  jobLog(jobId: string, row: string) {
    return this.send<{ jobId: string; row: {} }, void>({
      type: CommandTypes.JobUpdate,
      payload: {
        jobId,
        row
      }
    });
  }

  async close() {
    const ws = await this.connecting;
    ws.close();
  }
}
