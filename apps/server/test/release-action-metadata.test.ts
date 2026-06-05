import { describe, expect, it } from "vitest";
import type { WorkItem } from "@maintainerops/core";
import { ActionExecutor } from "../src/services/actions.js";
import type { GitHubWriteClient } from "../src/services/github.js";

describe("release draft action metadata", () => {
  it("trims tag and release names before calling GitHub", async () => {
    const github = recordingGitHub();
    const executor = new ActionExecutor(github.client);

    const result = await executor.execute(workItem(), {
      action: "create_release_draft",
      dryRun: false,
      metadata: {
        tagName: " v1.2.3 ",
        name: " MaintainerOps v1.2.3 ",
        body: "  keep release notes spacing  "
      }
    });

    expect(result.outcome).toBe("applied");
    expect(github.releaseInput).toEqual({
      tagName: "v1.2.3",
      name: "MaintainerOps v1.2.3",
      body: "  keep release notes spacing  "
    });
  });

  it("rejects whitespace-only release tags before calling GitHub", async () => {
    const github = recordingGitHub();
    const executor = new ActionExecutor(github.client);

    const result = await executor.execute(workItem(), {
      action: "create_release_draft",
      dryRun: false,
      metadata: { tagName: "   " }
    });

    expect(result.outcome).toBe("failed");
    expect(String(result.metadata.reason)).toContain("tagName");
    expect(github.releaseInput).toBeUndefined();
  });

  it("drops whitespace-only release names while keeping the tag", async () => {
    const github = recordingGitHub();
    const executor = new ActionExecutor(github.client);

    const result = await executor.execute(workItem(), {
      action: "create_release_draft",
      dryRun: false,
      metadata: {
        tagName: " v1.2.4 ",
        name: "   "
      }
    });

    expect(result.outcome).toBe("applied");
    expect(github.releaseInput).toEqual({ tagName: "v1.2.4", name: undefined, body: undefined });
  });
});

function recordingGitHub() {
  const state: {
    releaseInput?: { tagName: string; name?: string | undefined; body?: string | undefined };
    client: GitHubWriteClient;
  } = {
    client: {
      async writeCheckRun() {
        return { applied: true, metadata: {} };
      },
      async addLabels() {
        return { applied: true, metadata: {} };
      },
      async writeIssueComment() {
        return { applied: true, metadata: {} };
      },
      async createReleaseDraft(_workItem, input) {
        state.releaseInput = input;
        return { applied: true, metadata: { releaseId: 1 } };
      }
    }
  };
  return state;
}

function workItem(): WorkItem {
  return {
    id: "release:org/repo:v1.2.3",
    kind: "release",
    status: "open",
    repository: {
      owner: "org",
      name: "repo",
      fullName: "org/repo",
      private: false,
      installationId: 123
    },
    title: "Release v1.2.3",
    externalId: "release:org/repo:v1.2.3",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    labels: [],
    sourceDeliveryIds: ["delivery"],
    analysis: {
      summary: "Release needs review.",
      risk: { value: 10, priority: "normal", factors: [] },
      findings: [],
      recommendations: []
    }
  };
}
