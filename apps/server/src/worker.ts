import { loadConfig } from "./config.js";
import { SecurityScannerRunner } from "./services/scanners.js";
import { BullMqJobQueue } from "./services/jobs.js";
import { installShutdownHandlers } from "./services/shutdown.js";

const config = loadConfig({
  ...process.env,
  QUEUE_DRIVER: "bullmq",
  QUEUE_INLINE_WORKER: "true",
  SEED_DEMO_DATA: "false"
});

const scanners = new SecurityScannerRunner(config);
const queue = new BullMqJobQueue(config, scanners);

installShutdownHandlers(async () => queue.close());

console.log("MaintainerOps worker started");
