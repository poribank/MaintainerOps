import { describe, expect, it } from "vitest";
import type { WorkItem } from "@maintainerops/core";
import { InMemoryMaintainerStore } from "../src/services/store.js";

describe("MaintainerStore ingest status merging", () => {
  it("preserves maintainer triage across open webhooks and applies close/reopen transitions", () => {
    const store = new InMemoryMaintainerStore();
    const openItem = workItem("open", "delivery-1");

    store.ingest("delivery-1", [openItem]);
    store.recordAction(openItem.id, { actor: "maintainer", action: "triage" });

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
