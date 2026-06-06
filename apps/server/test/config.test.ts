import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("uses safe local defaults for pilots", () => {
    const config = loadConfig({ NODE_ENV: "test" });

    expect(config).toMatchObject({
      nodeEnv: "test",
      host: "0.0.0.0",
      port: 3000,
      webOrigin: "http://localhost:5173",
      github: {
        apiVersion: "2026-03-10",
        writesEnabled: false
      },
      storage: {
        driver: "memory"
      },
      queue: {
        driver: "memory",
        redisUrl: "redis://localhost:6379",
        inlineWorker: true
      },
      ai: {
        provider: "disabled",
        model: "chat-latest",
        maxInputChars: 12000
      },
      seedDemoData: true
    });
  });

  it("normalizes GitHub App credentials and write controls", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      GITHUB_APP_ID: "12345",
      GITHUB_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
      GITHUB_WEBHOOK_SECRET: "webhook-secret",
      GITHUB_API_VERSION: "2026-06-01",
      GITHUB_WRITES_ENABLED: "true"
    });

    expect(config.github).toEqual({
      appId: "12345",
      privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
      webhookSecret: "webhook-secret",
      apiVersion: "2026-06-01",
      writesEnabled: true
    });
  });

  it("loads persistent queue and scanner settings for restart-safe pilots", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      STORE_DRIVER: "postgres",
      DATABASE_URL: "postgres://maintainerops:maintainerops@localhost:5432/maintainerops",
      QUEUE_DRIVER: "bullmq",
      QUEUE_INLINE_WORKER: "false",
      REDIS_URL: "redis://localhost:6380",
      SCORECARD_COMMAND: "/usr/local/bin/scorecard",
      OSV_SCANNER_COMMAND: "/usr/local/bin/osv-scanner",
      SCANNER_WORKSPACE_ROOT: "../opensource",
      SCANNER_TIMEOUT_MS: "60000",
      SEED_DEMO_DATA: "false"
    });

    expect(config.storage).toEqual({
      driver: "postgres",
      databaseUrl: "postgres://maintainerops:maintainerops@localhost:5432/maintainerops"
    });
    expect(config.queue).toEqual({
      driver: "bullmq",
      redisUrl: "redis://localhost:6380",
      inlineWorker: false
    });
    expect(config.scanners).toEqual({
      scorecardCommand: "/usr/local/bin/scorecard",
      osvScannerCommand: "/usr/local/bin/osv-scanner",
      workspaceRoot: path.resolve("../opensource"),
      timeoutMs: 60000
    });
    expect(config.seedDemoData).toBe(false);
  });

  it("keeps AI disabled for unknown providers", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      AI_PROVIDER: "unknown",
      OPENAI_API_KEY: "test-key"
    });

    expect(config.ai).toMatchObject({
      provider: "disabled",
      apiKey: "test-key"
    });
  });
});
