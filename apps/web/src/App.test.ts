import { describe, expect, it } from "vitest";
import { actionRequestDryRun, buildStats, readApiError, scanSummary, type WorkItem } from "./App.js";

describe("dashboard helpers", () => {
  it("builds queue stats from work item risk and status", () => {
    const stats = buildStats([
      workItem({ id: "issue:org/repo:1", kind: "issue", status: "open", priority: "urgent" }),
      workItem({ id: "pr:org/repo:2", kind: "pull_request", status: "triaged", priority: "normal" }),
      workItem({ id: "security:org/repo:3", kind: "security", status: "open", priority: "high" }),
      workItem({ id: "release:org/repo:v1", kind: "release", status: "resolved", priority: "low" }),
      workItem({
        id: "issue:org/repo:4",
        kind: "issue",
        status: "triaged",
        priority: "normal",
        labels: ["Security"]
      })
    ]);

    expect(stats).toEqual({
      open: 2,
      urgent: 1,
      security: 2,
      repositories: 1
    });
  });

  it("summarizes Scorecard and OSV scanner payloads", () => {
    expect(scanSummary({ score: 7.2 })).toBe("Score 7.2");
    expect(scanSummary({ results: [{ id: "GHSA-1" }, { id: "GHSA-2" }] })).toBe("2 result groups");
    expect(scanSummary({ results: [] })).toBe("0 result groups");
    expect(scanSummary({ unexpected: true })).toBe("Scanner completed with JSON output");
  });

  it("uses non-dry-run requests only for local queue status actions", () => {
    expect(actionRequestDryRun("triage")).toBe(false);
    expect(actionRequestDryRun("resolve")).toBe(false);
    expect(actionRequestDryRun("write_check")).toBe(true);
  });

  it("reads API error payloads with a status fallback", async () => {
    await expect(
      readApiError(new Response(JSON.stringify({ error: "Repository or workItemId is required." }), { status: 400 }), "Job enqueue failed")
    ).resolves.toBe("Repository or workItemId is required.");

    await expect(
      readApiError(new Response(JSON.stringify({ message: "Body must be a JSON object." }), { status: 400 }), "Queue request failed")
    ).resolves.toBe("Body must be a JSON object.");

    await expect(readApiError(new Response("", { status: 500 }), "Action failed")).resolves.toBe("Action failed: 500");
  });
});

function workItem(input: {
  id: string;
  kind: WorkItem["kind"];
  status: WorkItem["status"];
  priority: WorkItem["analysis"]["risk"]["priority"];
  labels?: string[];
}): WorkItem {
  return {
    id: input.id,
    kind: input.kind,
    status: input.status,
    repository: {
      fullName: "org/repo",
      private: false
    },
    title: input.id,
    updatedAt: "2026-06-05T00:00:00.000Z",
    labels: input.labels ?? [],
    analysis: {
      summary: "Needs review.",
      risk: {
        value: input.priority === "urgent" ? 80 : input.priority === "high" ? 60 : 10,
        priority: input.priority,
        factors: []
      },
      findings: [],
      recommendations: []
    }
  };
}
