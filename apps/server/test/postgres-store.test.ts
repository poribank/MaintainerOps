import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { WorkItem } from "@maintainerops/core";
import { PostgresMaintainerStore } from "../src/services/postgres-store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

describePostgres("PostgresMaintainerStore", () => {
  const pool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresMaintainerStore(databaseUrl!);

  beforeEach(async () => {
    await pool.query("TRUNCATE audit_log, webhook_deliveries, work_items, repositories, installations RESTART IDENTITY CASCADE");
  });

  afterAll(async () => {
    await store.close();
    await pool.end();
  });

  it("persists applied queue status actions without re-running ingest merge rules", async () => {
    const item = workItem("open", "delivery-1");
    await store.ingest("delivery-1", [item], "issues");

    await store.recordAction(item.id, {
      actor: "maintainer",
      action: "triage",
      dryRun: false,
      outcome: "applied"
    });

    expect((await store.getWorkItem(item.id))?.status).toBe("triaged");

    await store.recordAction(item.id, {
      actor: "maintainer",
      action: "resolve",
      dryRun: true,
      outcome: "recorded"
    });

    expect((await store.getWorkItem(item.id))?.status).toBe("triaged");
  });
});

function workItem(status: WorkItem["status"], deliveryId: string): WorkItem {
  return {
    id: "issue:org/repo:5",
    kind: "issue",
    status,
    repository: {
      owner: "org",
      name: "repo",
      fullName: "org/repo",
      private: false
    },
    title: "Pilot issue",
    externalId: "issue:org/repo:5",
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:01.000Z",
    analysis: {
      summary: "Issue needs triage.",
      risk: {
        value: 1,
        priority: "low",
        factors: []
      },
      findings: [],
      recommendations: []
    },
    labels: [],
    sourceDeliveryIds: [deliveryId]
  };
}
