import { execFile } from "node:child_process";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("demo smoke script", () => {
  it("replays fixtures and records demo evidence signals", async () => {
    const config = loadConfig({
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "0",
      WEB_ORIGIN: "http://localhost:5173",
      GITHUB_WEBHOOK_SECRET: "test-secret",
      OSV_SCANNER_COMMAND: "maintainerops-osv-not-installed",
      SEED_DEMO_DATA: "false"
    });
    const { app } = await createApp({ config });
    await app.listen({ host: "127.0.0.1", port: 0 });

    try {
      const address = app.server.address() as AddressInfo;
      const { stdout } = await execFileAsync(
        process.execPath,
        ["scripts/demo-smoke.mjs", "--url", `http://127.0.0.1:${address.port}`, "--secret", "test-secret"],
        { cwd: root, timeout: 15000 }
      );
      const result = JSON.parse(stdout) as DemoSmokeResult;

      expect(result.replay).toHaveLength(4);
      expect(result.replay.every((entry) => entry.status === 202 && entry.count === 1)).toBe(true);
      expect(result.queue.total).toBe(4);
      expect(result.action).toMatchObject({ status: 202, outcome: "recorded", dryRun: true });
      expect(result.ai).toMatchObject({ status: 200, enabled: false, usedRawContent: false });
      expect(result.job).toMatchObject({ status: "completed", resultStatus: "unavailable" });
      expect(result.metrics).toMatchObject({
        workItems: 4,
        auditEntries: 2,
        aiAssists: 1,
        jobs: 1
      });
    } finally {
      await app.close();
    }
  });
});

interface DemoSmokeResult {
  replay: Array<{ status: number; count: number }>;
  queue: { total: number };
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
  metrics: {
    workItems: number;
    auditEntries: number;
    aiAssists: number;
    jobs: number;
  };
}
