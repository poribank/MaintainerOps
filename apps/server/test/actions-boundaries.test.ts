import { describe, expect, it } from "vitest";
import type { WorkItem } from "@maintainerops/core";
import { ActionExecutor } from "../src/services/actions.js";
import type { GitHubWriteClient } from "../src/services/github.js";

describe("ActionExecutor metadata boundaries", () => {
  it("trims label metadata before calling GitHub", async () => {
    const github = recordingGitHub();
    const executor = new ActionExecutor(github.client);

    const result = await executor.execute(workItem(), {
      action: "add_label",
      dryRun: false,
      metadata: { labels: [" bug ", "good first issue"] }
    });

    expect(result.outcome).toBe("applied");
    expect(github.labels).toEqual(["bug", "good first issue"]);
  });

  it("rejects whitespace-only labels before calling GitHub", async () => {
    const github = recordingGitHub();
    const executor = new ActionExecutor(github.client);

    const result = await executor.execute(workItem(), {
      action: "add_label",
      dryRun: false,
      metadata: { labels: ["bug", "   "] }
    });

    expect(result.outcome).toBe("failed");
    expect(String(result.metadata.reason)).toContain("labels");
    expect(github.labels).toEqual([]);
  });
});

function recordingGitHub() {
  const state: { labels: string[]; client: GitHubWriteClient } = {
    labels: [],
    client: {
      async writeCheckRun() {
        return { applied: true, metadata: {} };
      },
      async addLabels(_workItem, input) {
        state.labels = input.labels;
        return { applied: true, metadata: { labels: input.labels } };
      },
      async writeIssueComment() {
        return { applied: true, metadata: {} };
      },
      async createReleaseDraft() {
        return { applied: true, metadata: {} };
      }
    }
  };
  return state;
}

function workItem(): WorkItem {
  return {
    id: "issue:org/repo:1",
    kind: "issue",
    status: "open",
    repository: {
      owner: "org",
      name: "repo",
      fullName: "org/repo",
      private: false,
      installationId: 123
    },
    title: "Crash",
    number: 1,
    externalId: "issue:org/repo:1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    labels: [],
    sourceDeliveryIds: ["delivery"],
    analysis: {
      summary: "Issue needs triage.",
      risk: { value: 0, priority: "low", factors: [] },
      findings: [],
      recommendations: []
    }
  };
}
