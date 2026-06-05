import { describe, expect, it } from "vitest";
import type { WorkItem } from "@maintainerops/core";
import { ActionExecutor } from "../src/services/actions.js";
import type { GitHubWriteClient } from "../src/services/github.js";

describe("ActionExecutor", () => {
  it("records dry-run actions without calling GitHub", async () => {
    const executor = new ActionExecutor();
    const result = await executor.execute(workItem(), {
      action: "write_check",
      dryRun: true,
      metadata: { headSha: gitSha() }
    });

    expect(result.outcome).toBe("recorded");
    expect(result.metadata.mode).toBe("dry-run");
  });

  it("applies local queue actions without GitHub writes", async () => {
    const executor = new ActionExecutor();
    const result = await executor.execute(workItem(), {
      action: "triage",
      dryRun: false,
      metadata: {}
    });

    expect(result.outcome).toBe("applied");
    expect(result.metadata.mode).toBe("local-queue");
  });

  it("fails non-dry-run actions when GitHub writes are not configured", async () => {
    const executor = new ActionExecutor();
    const result = await executor.execute(workItem(), {
      action: "write_check",
      dryRun: false,
      metadata: { headSha: gitSha() }
    });

    expect(result.outcome).toBe("failed");
    expect(result.metadata.reason).toContain("GitHub writes are disabled");
  });

  it("applies supported GitHub actions through the write client", async () => {
    const executor = new ActionExecutor(fakeGitHub());
    const result = await executor.execute(workItem(), {
      action: "add_label",
      dryRun: false,
      metadata: { labels: ["bug"] }
    });

    expect(result.outcome).toBe("applied");
    expect(result.githubRequestId).toBe("request-1");
    expect(result.metadata.labels).toEqual(["bug"]);
  });

  it("fails GitHub write actions with invalid metadata before calling GitHub", async () => {
    const executor = new ActionExecutor(fakeGitHub());

    const labels = await executor.execute(workItem(), {
      action: "add_label",
      dryRun: false,
      metadata: { labels: ["bug", ""] }
    });
    const check = await executor.execute(workItem(), {
      action: "write_check",
      dryRun: false,
      metadata: {}
    });
    const malformedCheck = await executor.execute(workItem(), {
      action: "write_check",
      dryRun: false,
      metadata: { headSha: "abc123" }
    });
    const unsupported = await executor.execute(workItem(), {
      action: "merge",
      dryRun: false,
      metadata: {}
    });

    expect(labels).toMatchObject({
      outcome: "failed",
      metadata: { action: "add_label" }
    });
    expect(String(labels.metadata.reason)).toContain("labels");
    expect(check).toMatchObject({
      outcome: "failed",
      metadata: { action: "write_check" }
    });
    expect(String(check.metadata.reason)).toContain("headSha");
    expect(malformedCheck).toMatchObject({
      outcome: "failed",
      metadata: { action: "write_check" }
    });
    expect(String(malformedCheck.metadata.reason)).toContain("git commit SHA");
    expect(unsupported).toMatchObject({
      outcome: "failed",
      metadata: { action: "merge" }
    });
  });
});

function fakeGitHub(): GitHubWriteClient {
  return {
    async writeCheckRun() {
      return { applied: true, githubRequestId: "request-1", metadata: { checkRunId: 1 } };
    },
    async addLabels(_workItem, input) {
      return { applied: true, githubRequestId: "request-1", metadata: { labels: input.labels } };
    },
    async writeIssueComment() {
      return { applied: true, githubRequestId: "request-1", metadata: { commentId: 1 } };
    },
    async createReleaseDraft() {
      return { applied: true, githubRequestId: "request-1", metadata: { releaseId: 1 } };
    }
  };
}

function gitSha(): string {
  return "0123456789abcdef0123456789abcdef01234567";
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
