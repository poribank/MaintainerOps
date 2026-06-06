import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { installShutdownHandlers } from "./services/shutdown.js";

const config = loadConfig();
const { app } = await createApp({ config });
installShutdownHandlers(async () => app.close(), { logger: app.log });

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
