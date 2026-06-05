import { execFile } from "node:child_process";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { InMemoryMaintainerStore } from "../src/services/store.js";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("demo smoke script", () => {
  it("validates fixture replay, audit, AI, job, and evidence export against a live API", async () => {
    const outputDir = path.join(root, "tmp", `demo-smoke-test-${process.pid}`);
    const store = new InMemoryMaintainerStore();
    const { app } = await createApp({
      config: loadConfig({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "0",
        WEB_ORIGIN: "http://localhost:5173",
        GITHUB_WEBHOOK_SECRET: "test-secret",
        OSV_SCANNER_COMMAND: "maintainerops-osv-not-installed",
        SEED_DEMO_DATA: "false"
      }),
      store
    });

    await app.listen({ host: "127.0.0.1", port: 0 });

    try {
      const address = app.server.address() as AddressInfo;
      const { stdout } = await execFileAsync(
        process.execPath,
        [
          path.join(root, "scripts/demo-smoke.mjs"),
          "--url",
          `http://127.0.0.1:${address.port}`,
          "--secret",
          "test-secret",
          "--out",
          path.relative(root, outputDir)
        ],
        { cwd: root, timeout: 15000 }
      );
      const result = JSON.parse(stdout) as DemoSmokeResult;

      expect(result.ok).toBe(true);
      expect(result.replay).toHaveLength(4);
      expect(result.replay.every((entry) => entry.status === 202 && entry.count === 1)).toBe(true);
      expect(result.queue).toMatchObject({
        total: 4,
        kinds: ["issue", "pull_request", "release", "security"]
      });
      expect(result.action).toMatchObject({ status: 202, outcome: "recorded", dryRun: true });
      expect(result.ai).toMatchObject({ status: 200, enabled: false, usedRawContent: false });
      expect(result.job).toMatchObject({ status: "completed", resultStatus: "unavailable" });
      expect(result.metrics).toMatchObject({
        repositories: 1,
        workItems: 4,
        auditEntries: 2,
        aiAssists: 1,
        jobs: 1
      });
      expect(result.evidence.jsonPath).toContain(outputDir);
      expect(result.evidence.markdownPath).toContain(outputDir);
    } finally {
      await app.close();
      await rm(outputDir, { force: true, recursive: true });
    }
  });
});

interface DemoSmokeResult {
  ok: boolean;
  replay: Array<{ status: number; count: number }>;
  queue: {
    total: number;
    kinds: string[];
  };
  action?: {
    status: number;
    outcome: string;
    dryRun: boolean;
  };
  ai?: {
    status: number;
    enabled: boolean;
    usedRawContent: boolean;
  };
  job?: {
    status: string;
    resultStatus?: string;
  };
  evidence: {
    jsonPath: string;
    markdownPath: string;
  };
  metrics: {
    repositories: number;
    workItems: number;
    auditEntries: number;
    aiAssists: number;
    jobs: number;
  };
}
