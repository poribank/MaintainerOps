import { loadConfig } from "./config.js";
import { SecurityScannerRunner } from "./services/scanners.js";
import { BullMqJobQueue } from "./services/jobs.js";

const config = loadConfig({
  ...process.env,
  QUEUE_DRIVER: "bullmq",
  QUEUE_INLINE_WORKER: "true",
  SEED_DEMO_DATA: "false"
});

const scanners = new SecurityScannerRunner(config);
const queue = new BullMqJobQueue(config, scanners);

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});

console.log("MaintainerOps worker started");

async function shutdown(): Promise<void> {
  await queue.close();
  process.exit(0);
}
