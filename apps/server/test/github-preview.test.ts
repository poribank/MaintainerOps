import { describe, expect, it } from "vitest";
import type { Recommendation, WorkItem } from "@maintainerops/core";
import { buildCheckRunPreview } from "../src/services/github.js";

describe("GitHub check-run preview", () => {
  it("marks urgent work items as failing checks for maintainer attention", () => {
    const preview = buildCheckRunPreview(workItem({ priority: "urgent" }), "abc123");

    expect(preview).toMatchObject({
      name: "MaintainerOps",
      headSha: "abc123",
      status: "completed",
      conclusion: "failure",
      output: {
        title: "URGENT risk: Pilot issue",
        summary: "Issue needs triage."
      }
    });
  });

  it("renders recommendations as check-run markdown lines", () => {
    const preview = buildCheckRunPreview(
      workItem({
        recommendations: [
          {
            id: "demo:label",
            action: "add_label",
            title: "Add bug label",
            description: "Classify this report before routing.",
            confidence: 0.9,
            labels: ["bug"],
            requiresApproval: true
          }
        ]
      })
    );

    expect(preview.output.text).toBe("- Add bug label: Classify this report before routing.");
  });

  it("uses explicit fallback text when no recommendations are available", () => {
    const preview = buildCheckRunPreview(workItem({ recommendations: [] }));

    expect(preview.output.text).toBe("No MaintainerOps recommendations for this work item.");
  });
});

function workItem(input: {
  priority?: WorkItem["analysis"]["risk"]["priority"];
  recommendations?: Recommendation[];
}): WorkItem {
  return {
    id: "issue:org/repo:5",
    kind: "issue",
    status: "open",
    repository: {
      owner: "org",
      name: "repo",
      fullName: "org/repo",
      private: false
    },
    title: "Pilot issue",
    number: 5,
    externalId: "issue:org/repo:5",
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:01.000Z",
    analysis: {
      summary: "Issue needs triage.",
      risk: {
        value: input.priority === "urgent" ? 90 : 1,
        priority: input.priority ?? "low",
        factors: []
      },
      findings: [],
      recommendations: input.recommendations ?? []
    },
    labels: [],
    sourceDeliveryIds: ["delivery-1"]
  };
}
