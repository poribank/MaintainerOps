import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import type { MaintainerAiAssistant } from "../src/services/ai-assistant.js";
import type { JobQueue, MaintainerJob, MaintainerJobInput, MaintainerJobType } from "../src/services/jobs.js";
import { InMemoryMaintainerStore } from "../src/services/store.js";

describe("server", () => {
  it("serves health checks and demo queue", async () => {
    const { app } = await createTestApp();

    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.statusCode).toBe(200);

    const ready = await app.inject({ method: "GET", url: "/readyz" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json<{ checks: { store: boolean; queue: boolean } }>().checks).toEqual({
      store: true,
      queue: true
    });

    const queue = await app.inject({ method: "GET", url: "/api/queue" });
    expect(queue.statusCode).toBe(200);
    expect(queue.json<{ total: number }>().total).toBeGreaterThan(0);
  });

  it("reports readiness failures without failing liveness", async () => {
    const config = testConfig(false);
    const storeFailure = await createApp({ config, store: new FailingReadinessStore() });
    const queueFailure = await createApp({
      config,
      store: new InMemoryMaintainerStore(),
      jobs: failingJobQueue()
    });

    const health = await storeFailure.app.inject({ method: "GET", url: "/healthz" });
    expect(health.statusCode).toBe(200);

    const storeReady = await storeFailure.app.inject({ method: "GET", url: "/readyz" });
    expect(storeReady.statusCode).toBe(503);
    expect(storeReady.json<{ error: string; checks: { store: boolean; queue: boolean } }>()).toMatchObject({
      error: "Readiness checks failed.",
      checks: { store: false, queue: true }
    });

    const queueReady = await queueFailure.app.inject({ method: "GET", url: "/readyz" });
    expect(queueReady.statusCode).toBe(503);
    expect(queueReady.json<{ error: string; checks: { store: boolean; queue: boolean } }>()).toMatchObject({
      error: "Readiness checks failed.",
      checks: { store: true, queue: false }
    });
  });

  it("accepts signed GitHub webhooks once", async () => {
    const { app } = await createTestApp(false);
    const payload = JSON.stringify(issuePayload());
    const signature = sign(payload, "test-secret");

    const first = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-github-delivery": "delivery-1",
        "x-hub-signature-256": signature
      },
      payload
    });
    expect(first.statusCode).toBe(202);
    expect(first.json<{ count: number }>().count).toBe(1);

    const duplicate = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-github-delivery": "delivery-1",
        "x-hub-signature-256": signature
      },
      payload
    });
    expect(duplicate.statusCode).toBe(202);
    expect(duplicate.json<{ duplicate: boolean }>().duplicate).toBe(true);
  });

  it("rejects invalid webhook signatures", async () => {
    const { app } = await createTestApp(false);

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "content-type": "application/json",
        "x-github-event": "issues",
        "x-github-delivery": "delivery-2",
        "x-hub-signature-256": "sha256=bad"
      },
      payload: JSON.stringify(issuePayload())
    });

    expect(response.statusCode).toBe(401);
  });

  it("rejects malformed JSON request bodies with a client error", async () => {
    const { app, store } = await createTestApp();
    const item = store.listWorkItems()[0];
    expect(item).toBeDefined();

    const response = await app.inject({
      method: "POST",
      url: `/api/work-items/${encodeURIComponent(item!.id)}/actions`,
      headers: { "content-type": "application/json" },
      payload: "{"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ message: string }>().message).toContain("valid JSON");
  });

  it("rejects non-object JSON request bodies with a client error", async () => {
    const { app } = await createTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/policies/validate",
      headers: { "content-type": "application/json" },
      payload: "[]"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ message: string }>().message).toContain("JSON object");
  });

  it("records approved actions in the audit log", async () => {
    const { app, store } = await createTestApp();
    const item = store.listWorkItems()[0];
    expect(item).toBeDefined();

    const action = await app.inject({
      method: "POST",
      url: `/api/work-items/${encodeURIComponent(item!.id)}/actions`,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ action: "triage", actor: "maintainer", dryRun: false })
    });
    expect(action.statusCode).toBe(202);
    expect(store.getWorkItem(item!.id)?.status).toBe("triaged");

    const audit = await app.inject({ method: "GET", url: "/api/audit-log" });
    expect(audit.json<{ entries: Array<{ action: string }> }>().entries[0]?.action).toBe("triage");
  });

  it("does not change queue status for dry-run local actions", async () => {
    const { app, store } = await createTestApp();
    const item = store.listWorkItems()[0];
    expect(item).toBeDefined();

    const action = await app.inject({
      method: "POST",
      url: `/api/work-items/${encodeURIComponent(item!.id)}/actions`,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ action: "resolve", actor: "maintainer", dryRun: true })
    });
    expect(action.statusCode).toBe(202);
    expect(store.getWorkItem(item!.id)?.status).toBe(item!.status);
  });

  it("rejects unsupported work item actions", async () => {
    const { app, store } = await createTestApp();
    const item = store.listWorkItems()[0];
    expect(item).toBeDefined();

    const response = await app.inject({
      method: "POST",
      url: `/api/work-items/${encodeURIComponent(item!.id)}/actions`,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ action: "merge_without_review", actor: "maintainer", dryRun: true })
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: string }>().error).toContain("Unsupported action");
  });

  it("enqueues scanner jobs through the API", async () => {
    const { app } = await createTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/jobs/scans/scorecard",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ repository: "org/repo" })
    });

    expect(response.statusCode).toBe(202);
    const jobId = response.json<{ job: { id: string } }>().job.id;

    const job = await app.inject({ method: "GET", url: `/api/jobs/${jobId}` });
    expect(job.statusCode).toBe(200);
    expect(job.json<{ job: { type: string } }>().job.type).toBe("scan.scorecard");
  });

  it("rejects invalid scanner job inputs before enqueueing", async () => {
    const { app } = await createTestApp();

    const scorecard = await app.inject({
      method: "POST",
      url: "/api/jobs/scans/scorecard",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ repository: "bad repo" })
    });
    expect(scorecard.statusCode).toBe(400);
    expect(scorecard.json<{ error: string }>().error).toContain("owner/name");

    const osv = await app.inject({
      method: "POST",
      url: "/api/jobs/scans/osv",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ path: "../" })
    });
    expect(osv.statusCode).toBe(400);
    expect(osv.json<{ error: string }>().error).toContain("inside the MaintainerOps workspace");
  });

  it("normalizes job list limits from query strings", async () => {
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

    const limited = await app.inject({ method: "GET", url: "/api/jobs?limit=1" });
    expect(limited.statusCode).toBe(200);
    expect(limited.json<{ items: unknown[] }>().items).toHaveLength(1);

    const zero = await app.inject({ method: "GET", url: "/api/jobs?limit=0" });
    expect(zero.statusCode).toBe(200);
    expect(zero.json<{ items: unknown[] }>().items).toHaveLength(1);
  });

  it("returns disabled AI assistance without external configuration", async () => {
    const { app, store } = await createTestApp();
    const item = store.listWorkItems()[0];
    expect(item).toBeDefined();

    const response = await app.inject({
      method: "POST",
      url: `/api/work-items/${encodeURIComponent(item!.id)}/ai-assist`,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ includeRawContent: false })
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ assistance: { enabled: boolean; usedRawContent: boolean } }>().assistance).toMatchObject({
      enabled: false,
      usedRawContent: false
    });

    const audit = await app.inject({ method: "GET", url: "/api/audit-log" });
    expect(audit.json<{ entries: Array<{ action: string; metadata: { usedRawContent?: boolean } }> }>().entries[0]).toMatchObject({
      action: "ai_assist",
      metadata: { usedRawContent: false }
    });
  });

  it("rejects raw AI content without explicit repository policy opt-in", async () => {
    const { app, store } = await createTestApp();
    const item = store.listWorkItems()[0];
    expect(item).toBeDefined();

    const response = await app.inject({
      method: "POST",
      url: `/api/work-items/${encodeURIComponent(item!.id)}/ai-assist`,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        includeRawContent: true,
        rawContent: "diff --git a/file.ts b/file.ts"
      })
    });

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: string }>().error).toContain("explicit repository policy");

    const metrics = await app.inject({ method: "GET", url: "/api/pilot/metrics" });
    expect(metrics.json<{ audit: { aiRawContentTransfers: number; failed: number } }>().audit).toMatchObject({
      aiRawContentTransfers: 0,
      failed: 1
    });
  });

  it("audit logs raw AI content requests that omit rawContent", async () => {
    const { app, store } = await createAiTestApp();
    const item = store.listWorkItems()[0];
    expect(item).toBeDefined();

    const response = await app.inject({
      method: "POST",
      url: `/api/work-items/${encodeURIComponent(item!.id)}/ai-assist`,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        includeRawContent: true,
        policySource:
          "version: 1\nai:\n  enabled: true\n  provider: openai\ndataRetention:\n  rawContent: true\n  rawContentDays: 7\n"
      })
    });

    expect(response.statusCode).toBe(400);
    expect(response.json<{ error: string }>().error).toContain("rawContent is required");

    const metrics = await app.inject({ method: "GET", url: "/api/pilot/metrics" });
    expect(metrics.json<{ audit: { failed: number; aiRawContentTransfers: number } }>().audit).toMatchObject({
      failed: 1,
      aiRawContentTransfers: 0
    });
  });

  it("allows raw AI content only with explicit matching repository policy", async () => {
    const { app, store } = await createAiTestApp();
    const item = store.listWorkItems()[0];
    expect(item).toBeDefined();

    const response = await app.inject({
      method: "POST",
      url: `/api/work-items/${encodeURIComponent(item!.id)}/ai-assist`,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({
        includeRawContent: true,
        rawContent: "diff --git a/file.ts b/file.ts\n+const token = 'redacted';",
        policySource:
          "version: 1\nai:\n  enabled: true\n  provider: openai\ndataRetention:\n  rawContent: true\n  rawContentDays: 7\n"
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ assistance: { usedRawContent: boolean } }>().assistance.usedRawContent).toBe(true);

    const metrics = await app.inject({ method: "GET", url: "/api/pilot/metrics" });
    expect(metrics.json<{ audit: { aiRawContentTransfers: number } }>().audit.aiRawContentTransfers).toBe(1);
  });

  it("reports pilot metrics for application evidence", async () => {
    const { app } = await createTestApp();
    const response = await app.inject({ method: "GET", url: "/api/pilot/metrics" });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ workItems: { total: number }; recommendations: { total: number } }>().workItems.total).toBeGreaterThan(0);
  });
});

async function createTestApp(seedDemoData = true) {
  return createApp({ config: testConfig(seedDemoData), store: new InMemoryMaintainerStore() });
}

function testConfig(seedDemoData = true) {
  return loadConfig({
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: "0",
    WEB_ORIGIN: "http://localhost:5173",
    GITHUB_WEBHOOK_SECRET: "test-secret",
    SEED_DEMO_DATA: seedDemoData ? "true" : "false"
  });
}

async function createAiTestApp() {
  const config = loadConfig({
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: "0",
    WEB_ORIGIN: "http://localhost:5173",
    GITHUB_WEBHOOK_SECRET: "test-secret",
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "test-model",
    SEED_DEMO_DATA: "true"
  });
  return createApp({
    config,
    store: new InMemoryMaintainerStore(),
    aiAssistant: fakeAiAssistant()
  });
}

function fakeAiAssistant(): MaintainerAiAssistant {
  return {
    async assist(_workItem, request) {
      return {
        enabled: true,
        provider: "openai",
        model: "test-model",
        summary: "Fake maintainer assistance.",
        rationale: ["Repository policy allowed this request."],
        suggestedActions: ["Review the generated summary."],
        safetyNotes: ["Maintainer approval is still required."],
        usedRawContent: request.includeRawContent,
        redacted: false
      };
    }
  };
}

class FailingReadinessStore extends InMemoryMaintainerStore {
  override listRepositories(): never {
    throw new Error("store unavailable");
  }
}

function failingJobQueue(): JobQueue {
  return {
    async enqueue(_type: MaintainerJobType, _input: MaintainerJobInput): Promise<MaintainerJob> {
      throw new Error("queue unavailable");
    },
    async get(): Promise<MaintainerJob | undefined> {
      return undefined;
    },
    async list(): Promise<MaintainerJob[]> {
      throw new Error("queue unavailable");
    },
    async close(): Promise<void> {
      return undefined;
    }
  };
}

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

function issuePayload() {
  return {
    repository: {
      id: 1,
      full_name: "org/repo",
      name: "repo",
      private: false,
      owner: { login: "org" }
    },
    issue: {
      number: 42,
      title: "Crash when token refresh fails",
      body: "Throws exception on startup",
      html_url: "https://github.com/org/repo/issues/42",
      labels: []
    },
    sender: { login: "reporter" }
  };
}
