import { QueueClient, QueueWorker } from "../src";

const run = async () => {
  const opts = {
    //host: "wss://eu-west.taskforce.run",
    host: "ws://localhost:8080",
    token: "12345678",
    // connectionId: "id-91976242-a655-4801-a2e4-71aaa6fe2f2c",
    connectionId: "id-e694d42a-7743-4d70-acc6-eb3189c10fc4",
    queueName: "test queue"
  };
  const client = new QueueClient<{ foo: string }>(opts);

  client.on("waiting", (jobId: string) => {
    console.log("job waiting...", jobId);
    return;
  });

  client.on("global:active", (...args) => {
    // console.log("job active", args);
  });

  try {
    console.log("About to add a jobs serially");
    const start = Date.now();
    const promises = [];
    for (let j = 0; j < 10; j++) {
      for (let i = 0; i < 1000; i++) {
        promises.push(client.add({ foo: "bar" }));
      }
    }
    await Promise.all(promises);
    console.log("Duration", Date.now() - start);
  } catch (err) {
    console.error("error adding job", err);
  }

  const worker = new QueueWorker({ connect: opts, concurrency: 32 });

  let index = 0;
  console.log("Gonna process now...");
  const startProcess = Date.now();
  worker.process(async job => {
    index++;
    if (index === 9999) {
      console.log("COMPLETED", Date.now() - startProcess);
    }
  });

  worker.on("active", job => {
    console.log("active", job);
  });

  const completed = await client.getCompleted(0, 100, true);

  console.log(completed.length);
};

run();
