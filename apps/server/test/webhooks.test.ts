import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { InMemoryMaintainerStore } from "../src/services/store.js";

describe("GitHub webhook routes", () => {
  it("reports duplicates detected during ingest", async () => {
    const body = JSON.stringify(issuePayload());
    const store = new RaceyDuplicateStore();
    const { app } = await createApp({
      config: loadConfig({
        NODE_ENV: "test",
        GITHUB_WEBHOOK_SECRET: "test-secret",
        SEED_DEMO_DATA: "false"
      }),
      store
    });

    const first = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: signedHeaders(body, "delivery-race"),
      payload: body
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: signedHeaders(body, "delivery-race"),
      payload: body
    });

    expect(first.statusCode).toBe(202);
    expect(first.json<{ accepted: boolean; duplicate: boolean }>())
      .toMatchObject({ accepted: true, duplicate: false });
    expect(duplicate.statusCode).toBe(202);
    expect(duplicate.json<{ accepted: boolean; duplicate: boolean; items: unknown[] }>())
      .toMatchObject({ accepted: false, duplicate: true, items: [] });
  });
});

class RaceyDuplicateStore extends InMemoryMaintainerStore {
  hasDelivery(): boolean {
    return false;
  }
}

function signedHeaders(body: string, delivery: string) {
  return {
    "content-type": "application/json",
    "x-github-event": "issues",
    "x-github-delivery": delivery,
    "x-hub-signature-256": `sha256=${createHmac("sha256", "test-secret").update(body).digest("hex")}`
  };
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
