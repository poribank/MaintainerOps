import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";
import type { AppConfig } from "./config.js";
import { registerApiRoutes } from "./routes/api.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { ActionExecutor } from "./services/actions.js";
import { createMaintainerAiAssistant, type MaintainerAiAssistant } from "./services/ai-assistant.js";
import { createGitHubWriteClient } from "./services/github.js";
import { createJobQueue, type JobQueue } from "./services/jobs.js";
import { SecurityScannerRunner } from "./services/scanners.js";
import { createMaintainerStore } from "./services/store-factory.js";
import type { MaintainerStore } from "./services/store.js";

export interface CreateAppOptions {
  config: AppConfig;
  store?: MaintainerStore;
  actions?: ActionExecutor;
  jobs?: JobQueue;
  aiAssistant?: MaintainerAiAssistant;
}

export async function createApp(options: CreateAppOptions) {
  const app = Fastify({
    logger: {
      level: options.config.nodeEnv === "test" ? "silent" : "info"
    }
  });
  const store = options.store ?? createMaintainerStore(options.config);
  const actions = options.actions ?? new ActionExecutor(createGitHubWriteClient(options.config));
  const scanners = new SecurityScannerRunner(options.config);
  const jobs = options.jobs ?? createJobQueue(options.config, scanners);
  const aiAssistant = options.aiAssistant ?? createMaintainerAiAssistant(options.config);

  if (options.config.seedDemoData && store.seedDemoData) {
    await store.seedDemoData();
  }

  app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    done(null, body);
  });

  await app.register(helmet);
  await app.register(cors, { origin: options.config.webOrigin });

  registerWebhookRoutes(app, options.config, store);
  registerApiRoutes(app, options.config, store, actions, scanners, jobs, aiAssistant);

  app.addHook("onClose", async () => {
    await jobs.close();
    await store.close?.();
  });

  return { app, store, jobs };
}
