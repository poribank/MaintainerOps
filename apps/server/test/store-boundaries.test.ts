import { describe, expect, it } from "vitest";
import type { AuditLogEntry, WorkItem } from "@maintainerops/core";
import { InMemoryMaintainerStore } from "../src/services/store.js";

describe("InMemoryMaintainerStore object boundaries", () => {
  it("clones ingested work items and returned work item views", () => {
    const store = new InMemoryMaintainerStore();
    const incoming = workItem("open", "delivery-1");
    const result = store.ingest("delivery-1", [incoming]);

    incoming.status = "resolved";
    incoming.analysis.summary = "mutated input";
    result.items[0]!.labels.push("mutated-result");

    const listed = store.listWorkItems()[0]!;
    listed.status = "resolved";
    listed.analysis.summary = "mutated list result";
    listed.labels.push("mutated-list");

    const stored = store.getWorkItem(incoming.id);
    expect(stored).toMatchObject({
      status: "open",
      labels: [],
      analysis: { summary: "Issue needs triage." }
    });
  });

  it("clones repositories returned from the store", () => {
    const store = new InMemoryMaintainerStore();
    store.ingest("delivery-1", [workItem("open", "delivery-1")]);

    const repository = store.listRepositories()[0]!;
    repository.name = "mutated";
    repository.fullName = "mutated/repo";

    expect(store.listRepositories()[0]).toMatchObject({
      name: "repo",
      fullName: "org/repo"
    });
  });

  it("clones audit log entries and metadata at write and read boundaries", () => {
    const store = new InMemoryMaintainerStore();
    const item = workItem("open", "delivery-1");
    const metadata = { nested: { value: "original" } };
    store.ingest("delivery-1", [item]);

    const entry = store.recordAction(item.id, {
      actor: "maintainer",
      action: "triage",
      dryRun: true,
      outcome: "recorded",
      metadata
    });
    metadata.nested.value = "mutated input";
    readNested(entry).value = "mutated returned entry";

    const listed = store.listAuditLog()[0]!;
    readNested(listed).value = "mutated listed entry";

    expect(readNested(store.listAuditLog()[0]!).value).toBe("original");
  });
});

function readNested(entry: AuditLogEntry): { value: string } {
  return entry.metadata.nested as { value: string };
}

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
