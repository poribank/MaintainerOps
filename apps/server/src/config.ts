import path from "node:path";

export interface AppConfig {
  nodeEnv: string;
  host: string;
  port: number;
  webOrigin: string;
  github: {
    appId?: string;
    privateKey?: string;
    webhookSecret?: string;
    apiVersion: string;
    writesEnabled: boolean;
  };
  storage: {
    driver: "memory" | "postgres";
    databaseUrl?: string;
  };
  queue: {
    driver: "memory" | "bullmq";
    redisUrl: string;
    inlineWorker: boolean;
  };
  ai: {
    provider: "disabled" | "openai" | "anthropic" | "local";
    apiKey?: string;
    model: string;
    maxInputChars: number;
  };
  scanners: {
    scorecardCommand: string;
    osvScannerCommand: string;
    workspaceRoot: string;
    timeoutMs: number;
  };
  seedDemoData: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const github: AppConfig["github"] = {
    apiVersion: env.GITHUB_API_VERSION || "2026-03-10",
    writesEnabled: env.GITHUB_WRITES_ENABLED === "true"
  };
  const ai: AppConfig["ai"] = {
    provider: parseAiProvider(env.AI_PROVIDER),
    model: env.OPENAI_MODEL || "chat-latest",
    maxInputChars: parseIntegerEnv(env.AI_MAX_INPUT_CHARS, 12000, { min: 1 })
  };
  const storage: AppConfig["storage"] = {
    driver: env.STORE_DRIVER === "postgres" ? "postgres" : "memory"
  };
  const queue: AppConfig["queue"] = {
    driver: env.QUEUE_DRIVER === "bullmq" ? "bullmq" : "memory",
    redisUrl: env.REDIS_URL || "redis://localhost:6379",
    inlineWorker: env.QUEUE_INLINE_WORKER !== "false"
  };

  if (env.GITHUB_APP_ID) github.appId = env.GITHUB_APP_ID;
  if (env.GITHUB_PRIVATE_KEY) github.privateKey = env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n");
  if (env.GITHUB_WEBHOOK_SECRET) github.webhookSecret = env.GITHUB_WEBHOOK_SECRET;
  if (env.AI_API_KEY) ai.apiKey = env.AI_API_KEY;
  if (env.OPENAI_API_KEY) ai.apiKey = env.OPENAI_API_KEY;
  if (env.DATABASE_URL) storage.databaseUrl = env.DATABASE_URL;

  return {
    nodeEnv: env.NODE_ENV || "development",
    host: env.HOST || "0.0.0.0",
    port: parseIntegerEnv(env.PORT, 3000, { min: 0 }),
    webOrigin: env.WEB_ORIGIN || "http://localhost:5173",
    github,
    storage,
    queue,
    ai,
    scanners: {
      scorecardCommand: env.SCORECARD_COMMAND || "scorecard",
      osvScannerCommand: env.OSV_SCANNER_COMMAND || "osv-scanner",
      workspaceRoot: path.resolve(env.SCANNER_WORKSPACE_ROOT || env.INIT_CWD || process.cwd()),
      timeoutMs: parseIntegerEnv(env.SCANNER_TIMEOUT_MS, 120000, { min: 1 })
    },
    seedDemoData: env.SEED_DEMO_DATA !== "false"
  };
}

function parseAiProvider(value: string | undefined): AppConfig["ai"]["provider"] {
  if (value === "openai" || value === "anthropic" || value === "local") {
    return value;
  }
  return "disabled";
}

function parseIntegerEnv(value: string | undefined, fallback: number, options: { min: number }): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < options.min) return fallback;
  return parsed;
}
