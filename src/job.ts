import { JobOptions } from "bull";

export class Job<T, K = void> {
  id: string;
  name: string = "__default__";
  data: T;
  opts: JobOptions;
  progress: number | object;
  delay: number;
  timestamp: number;
  attemptsMade: number;
  stacktrace: string[];
  returnvalue: K;
  finishedOn: number;
  processedOn: number;

  retry() {}
  promote() {}
  remove() {}
  discard() {}
}
