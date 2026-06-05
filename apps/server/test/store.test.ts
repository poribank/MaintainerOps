import { describe, expect, it } from "vitest";
import type { WorkItem } from "@maintainerops/core";
import { InMemoryMaintainerStore } from "../src/services/store.js";

describe("MaintainerStore ingest status merging", () => {
  it("preserves maintainer triage across open webhooks and applies close/reopen transitions", () => {
    const store = new InMemoryMaintainerStore();
    const openItem = workItem("open", "delivery-1");

    store.ingest("delivery-1", [openItem]);
    store.recordAction(openItem.id, { actor: "maintainer", action: "triage", dryRun: false, outcome: "applied" });

    store.ingest("delivery-2", [workItem("open", "delivery-2")]);
    expect(store.getWorkItem(openItem.id)?.status).toBe("triaged");

    store.ingest("delivery-3", [workItem("resolved", "delivery-3")]);
    expect(store.getWorkItem(openItem.id)?.status).toBe("resolved");

    store.ingest("delivery-4", [workItem("open", "delivery-4")]);
    expect(store.getWorkItem(openItem.id)?.status).toBe("open");
    expect(store.getWorkItem(openItem.id)?.sourceDeliveryIds).toEqual([
      "delivery-1",
      "delivery-2",
      "delivery-3",
      "delivery-4"
    ]);
  });

  it("does not apply failed or dry-run status actions", () => {
    const store = new InMemoryMaintainerStore();
    const openItem = workItem("open", "delivery-1");

    store.ingest("delivery-1", [openItem]);
    store.recordAction(openItem.id, { actor: "maintainer", action: "triage", dryRun: true, outcome: "recorded" });
    expect(store.getWorkItem(openItem.id)?.status).toBe("open");

    store.recordAction(openItem.id, { actor: "maintainer", action: "resolve", dryRun: false, outcome: "failed" });
    expect(store.getWorkItem(openItem.id)?.status).toBe("open");
  });

  it("does not expose mutable references to stored work items or audit entries", () => {
    const store = new InMemoryMaintainerStore();
    const openItem = workItem("open", "delivery-1");
    const result = store.ingest("delivery-1", [openItem]);

    openItem.title = "mutated original";
    result.items[0]!.title = "mutated ingest result";
    result.items[0]!.analysis.recommendations.push({
      id: "test:mutated",
      action: "add_label",
      title: "Mutated",
      description: "This should not leak into the store.",
      confidence: 1,
      requiresApproval: false
    });

    const listed = store.listWorkItems()[0]!;
    listed.title = "mutated list result";
    listed.repository.fullName = "mutated/repo";
    listed.sourceDeliveryIds.push("mutated-delivery");

    const fetched = store.getWorkItem(openItem.id)!;
    fetched.title = "mutated fetched result";
    fetched.analysis.risk.factors.push({
      id: "test:mutated-factor",
      label: "Mutated factor",
      points: 100,
      severity: "critical"
    });

    const audit = store.recordAction(openItem.id, {
      actor: "maintainer",
      action: "triage",
      dryRun: true,
      metadata: { nested: { value: "original" } }
    });
    audit.actor = "mutated";
    audit.metadata.nested = { value: "mutated" };
    store.listAuditLog()[0]!.metadata.nested = { value: "mutated-list" };

    const stored = store.getWorkItem(openItem.id)!;
    expect(stored.title).toBe("Pilot issue");
    expect(stored.repository.fullName).toBe("org/repo");
    expect(stored.sourceDeliveryIds).toEqual(["delivery-1"]);
    expect(stored.analysis.recommendations).toHaveLength(0);
    expect(stored.analysis.risk.factors).toHaveLength(0);
    expect(store.listRepositories()[0]?.fullName).toBe("org/repo");
    expect(store.listAuditLog()[0]).toMatchObject({
      actor: "maintainer",
      metadata: { nested: { value: "original" } }
    });
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
