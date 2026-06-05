import { execFile } from "node:child_process";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { InMemoryMaintainerStore } from "../src/services/store.js";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(process.cwd(), "../..");
const replayScript = path.join(repoRoot, "scripts/replay-webhook-fixtures.mjs");

describe("webhook fixture replay CLI", () => {
  it("replays a selected fixture into a live local webhook endpoint", async () => {
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

    await app.listen({ host: "127.0.0.1", port: 0 });

    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [
        replayScript,
        "--url",
        `${webhookUrl(app.server.address())}`,
        "--secret",
        "test-secret",
        "--fixture",
        "issues.opened.json",
        "--deliveryPrefix",
        "vitest"
      ]);

      expect(stderr).toBe("");
      const result = JSON.parse(stdout) as {
        event: string;
        status: number;
        response: { accepted: boolean; count: number; items: Array<{ kind: string; title: string }> };
      };
      expect(result.event).toBe("issues");
      expect(result.status).toBe(202);
      expect(result.response).toMatchObject({ accepted: true, count: 1 });
      expect(result.response.items[0]).toMatchObject({
        kind: "issue",
        title: "Crash when auth token refresh fails"
      });

      const issues = store.listWorkItems({ kind: "issue" });
      expect(issues).toHaveLength(1);
      expect(issues[0]?.sourceDeliveryIds[0]).toContain("vitest-issues-");
    } finally {
      await app.close();
    }
  });
});

function webhookUrl(address: string | AddressInfo | null): string {
  if (!address || typeof address === "string") {
    throw new Error("Expected Fastify to listen on a TCP port.");
  }
  return `http://127.0.0.1:${address.port}/webhooks/github`;
}
