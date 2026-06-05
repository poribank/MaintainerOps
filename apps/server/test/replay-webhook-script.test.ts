import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { InMemoryMaintainerStore } from "../src/services/store.js";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("replay webhook fixture script", () => {
  it("posts a selected fixture with equals-style CLI arguments", async () => {
    const store = new InMemoryMaintainerStore();
    const { app } = await createApp({
      config: loadConfig({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "0",
        WEB_ORIGIN: "http://localhost:5173",
        GITHUB_WEBHOOK_SECRET: "test-secret",
        SEED_DEMO_DATA: "false"
      }),
      store
    });

    try {
      await app.listen({ host: "127.0.0.1", port: 0 });
      const address = app.server.address() as AddressInfo;
      const { stdout } = await execFileAsync(
        process.execPath,
        [
          path.join(root, "scripts/replay-webhook-fixtures.mjs"),
          `--url=http://127.0.0.1:${address.port}/webhooks/github`,
          "--secret=test-secret",
          "--fixture=issues.opened.json",
          "--delivery-prefix=ci"
        ],
        { cwd: root }
      );

      const output = JSON.parse(stdout) as { delivery: string; event: string; status: number };
      expect(output).toMatchObject({ event: "issues", status: 202 });
      expect(output.delivery).toMatch(/^ci-issues-/);
      expect(store.listWorkItems()).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
