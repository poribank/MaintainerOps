import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { InMemoryMaintainerStore } from "../src/services/store.js";

describe("API input boundaries", () => {
  let openApps: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(openApps.map((app) => app.close()));
    openApps = [];
  });

  it("treats whitespace-only action and policy source values as missing", async () => {
    const { app, store } = await createTestApp();
    const item = store.listWorkItems()[0];
    expect(item).toBeDefined();

    const action = await app.inject({
      method: "POST",
      url: `/api/work-items/${encodeURIComponent(item!.id)}/actions`,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ action: "   " })
    });
    expect(action.statusCode).toBe(400);
    expect(action.json<{ error: string }>().error).toContain("Action is required");

    const policy = await app.inject({
      method: "POST",
      url: "/api/policies/validate",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ source: "   " })
    });
    expect(policy.statusCode).toBe(400);
    expect(policy.json<{ error: string }>().error).toContain("Policy source is required");
  });

  it("trims repository scanner inputs before validation and enqueueing", async () => {
    const { app } = await createTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/jobs/scans/scorecard",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ repository: " org/repo " })
    });

    expect(response.statusCode).toBe(202);
    expect(response.json<{ job: { input: { repository: string } } }>().job.input.repository).toBe("org/repo");
  });

  it("trims queue filters from query strings", async () => {
    const { app } = await createTestApp();

    const response = await app.inject({ method: "GET", url: "/api/queue?kind=%20issue%20&status=%20open%20" });

    expect(response.statusCode).toBe(200);
    const body = response.json<{ total: number; items: Array<{ kind: string; status: string }> }>();
    expect(body.total).toBeGreaterThan(0);
    expect(body.items.every((item) => item.kind === "issue" && item.status === "open")).toBe(true);
  });

  it("does not parse partially numeric job limits", async () => {
    const { app } = await createTestApp();

    await app.inject({
      method: "POST",
      url: "/api/jobs/scans/osv",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ path: "." })
    });
    await app.inject({
      method: "POST",
      url: "/api/jobs/scans/osv",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ path: "." })
    });

    const partial = await app.inject({ method: "GET", url: "/api/jobs?limit=1abc" });
    expect(partial.statusCode).toBe(200);
    expect(partial.json<{ items: unknown[] }>().items).toHaveLength(2);

    const strict = await app.inject({ method: "GET", url: "/api/jobs?limit=1" });
    expect(strict.statusCode).toBe(200);
    expect(strict.json<{ items: unknown[] }>().items).toHaveLength(1);
  });

  async function createTestApp() {
    const created = await createApp({
      config: loadConfig({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "0",
        WEB_ORIGIN: "http://localhost:5173",
        GITHUB_WEBHOOK_SECRET: "test-secret",
        OSV_SCANNER_COMMAND: "maintainerops-osv-not-installed",
        SCORECARD_COMMAND: "maintainerops-scorecard-not-installed",
        SEED_DEMO_DATA: "true"
      }),
      store: new InMemoryMaintainerStore()
    });
    openApps.push(created.app);
    return created;
  }
});
