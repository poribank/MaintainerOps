import { describe, expect, it } from "vitest";
import type { WorkItem } from "@maintainerops/core";
import { loadConfig } from "../src/config.js";
import {
  buildCheckRunPreview,
  createGitHubWriteClient,
  OctokitGitHubWriteClient
} from "../src/services/github.js";

describe("GitHub write adapter", () => {
  it("is disabled unless writes and app credentials are configured", () => {
    expect(createGitHubWriteClient(config({ writesEnabled: false }))).toBeUndefined();
    expect(
      createGitHubWriteClient(
        loadConfig({
          NODE_ENV: "test",
          GITHUB_WRITES_ENABLED: "true",
          GITHUB_PRIVATE_KEY: "test-key"
        })
      )
    ).toBeUndefined();
  });

  it("builds urgent check-run previews as failures", () => {
    const preview = buildCheckRunPreview(workItem({ priority: "urgent" }), "abc123");

    expect(preview).toMatchObject({
      name: "MaintainerOps",
      headSha: "abc123",
      conclusion: "failure",
      output: {
        title: "URGENT risk: Demo work item"
      }
    });
    expect(preview.output.text).toContain("- Review release workflow");
  });

  it("writes check runs through the installation client", async () => {
    const calls: RequestCall[] = [];
    const client = new OctokitGitHubWriteClient(config(), fakeApp(calls, { id: 101 }));

    const result = await client.writeCheckRun(workItem(), { headSha: "abc123" });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      installationId: 123,
      route: "POST /repos/{owner}/{repo}/check-runs",
      parameters: {
        owner: "org",
        repo: "repo",
        name: "MaintainerOps",
        head_sha: "abc123",
        status: "completed",
        conclusion: "neutral",
        headers: { "X-GitHub-Api-Version": "2026-03-10" }
      }
    });
    expect(result).toMatchObject({
      applied: true,
      githubRequestId: "request-1",
      metadata: { checkRunId: 101, conclusion: "neutral" }
    });
  });

  it("adds labels, writes comments, and creates release drafts", async () => {
    const calls: RequestCall[] = [];
    const client = new OctokitGitHubWriteClient(
      config(),
      fakeApp(calls, [
        [{ name: "bug" }, { name: "security" }],
        { id: 202, html_url: "https://github.com/org/repo/issues/5#issuecomment-202" },
        { id: 303, html_url: "https://github.com/org/repo/releases/tag/v1.2.3" }
      ])
    );
    const item = workItem();

    await expect(client.addLabels(item, { labels: ["bug", "", "security"] })).resolves.toMatchObject({
      metadata: { labels: ["bug", "security"] }
    });
    await expect(client.writeIssueComment(item, { body: "MaintainerOps summary" })).resolves.toMatchObject({
      metadata: { commentId: 202 }
    });
    await expect(
      client.createReleaseDraft(item, {
        tagName: "v1.2.3",
        name: "Version 1.2.3",
        body: "Draft release notes"
      })
    ).resolves.toMatchObject({
      metadata: { releaseId: 303 }
    });

    expect(calls.map((call) => call.route)).toEqual([
      "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      "POST /repos/{owner}/{repo}/releases"
    ]);
    expect(calls[0]?.parameters).toMatchObject({
      issue_number: 5,
      labels: ["bug", "security"]
    });
    expect(calls[1]?.parameters).toMatchObject({
      issue_number: 5,
      body: "MaintainerOps summary"
    });
    expect(calls[2]?.parameters).toMatchObject({
      tag_name: "v1.2.3",
      name: "Version 1.2.3",
      body: "Draft release notes",
      draft: true,
      prerelease: false
    });
  });

  it("rejects write actions without required GitHub metadata", async () => {
    const client = new OctokitGitHubWriteClient(config(), fakeApp([], { id: 1 }));
    const itemWithoutNumber = workItem({ number: null });
    const itemWithoutInstallation = workItem({ installationId: null });

    await expect(client.addLabels(itemWithoutNumber, { labels: ["bug"] })).rejects.toThrow("number is required");
    await expect(client.writeIssueComment(itemWithoutNumber, { body: "body" })).rejects.toThrow("number is required");
    await expect(client.writeIssueComment(workItem(), { body: " " })).rejects.toThrow("Comment body is required");
    await expect(client.createReleaseDraft(workItem(), { tagName: " " })).rejects.toThrow("Release tag name is required");
    await expect(client.writeCheckRun(itemWithoutInstallation, { headSha: "abc123" })).rejects.toThrow(
      "installation id is required"
    );
  });
});

interface RequestCall {
  installationId: number;
  route: string;
  parameters: Record<string, unknown>;
}

function fakeApp(calls: RequestCall[], responses: unknown | unknown[]) {
  const queue = Array.isArray(responses) ? [...responses] : [responses];
  return {
    async getInstallationOctokit(installationId: number) {
      return {
        async request(route: string, parameters: Record<string, unknown>) {
          calls.push({ installationId, route, parameters });
          return {
            headers: { "x-github-request-id": "request-1" },
            data: queue.shift() ?? {}
          };
        }
      };
    }
  };
}

function config(input: { writesEnabled?: boolean } = {}) {
  return loadConfig({
    NODE_ENV: "test",
    GITHUB_WRITES_ENABLED: input.writesEnabled === false ? "false" : "true",
    GITHUB_APP_ID: "12345",
    GITHUB_PRIVATE_KEY: "test-key",
    GITHUB_API_VERSION: "2026-03-10"
  });
}

function workItem(
  input: { priority?: WorkItem["analysis"]["risk"]["priority"]; number?: number | null; installationId?: number | null } = {}
): WorkItem {
  const repository: WorkItem["repository"] = {
    owner: "org",
    name: "repo",
    fullName: "org/repo",
    private: false
  };
  if (input.installationId !== null) {
    repository.installationId = input.installationId ?? 123;
  }

  const item: WorkItem = {
    id: "pull_request:org/repo:5",
    kind: "pull_request",
    status: "open",
    repository,
    title: "Demo work item",
    externalId: "pull_request:org/repo:5",
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:01.000Z",
    labels: [],
    sourceDeliveryIds: ["delivery-1"],
    analysis: {
      summary: "Review the release workflow change.",
      risk: {
        value: 7,
        priority: input.priority ?? "normal",
        factors: []
      },
      findings: [],
      recommendations: [
        {
          id: "recommendation-1",
          action: "write_check",
          title: "Review release workflow",
          description: "Summarize release workflow risks before merge.",
          confidence: 0.9,
          requiresApproval: true
        }
      ]
    }
  };
  if (input.number !== null) {
    item.number = input.number ?? 5;
  }
  return item;
}
