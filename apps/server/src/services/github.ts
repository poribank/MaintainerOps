import { App } from "@octokit/app";
import type { Octokit } from "@octokit/rest";
import type { Recommendation, WorkItem } from "@maintainerops/core";
import type { AppConfig } from "../config.js";

export interface CheckRunPreview {
  name: string;
  headSha: string;
  status: "completed";
  conclusion: "success" | "neutral" | "failure";
  output: {
    title: string;
    summary: string;
    text: string;
  };
}

export interface GitHubWriteResult {
  applied: boolean;
  githubRequestId?: string | undefined;
  metadata: Record<string, unknown>;
}

export interface GitHubWriteClient {
  writeCheckRun(workItem: WorkItem, input: { headSha: string }): Promise<GitHubWriteResult>;
  addLabels(workItem: WorkItem, input: { labels: string[] }): Promise<GitHubWriteResult>;
  writeIssueComment(workItem: WorkItem, input: { body: string }): Promise<GitHubWriteResult>;
  createReleaseDraft(
    workItem: WorkItem,
    input: { tagName: string; name?: string | undefined; body?: string | undefined }
  ): Promise<GitHubWriteResult>;
}

export const MINIMUM_GITHUB_APP_PERMISSIONS = {
  metadata: "read",
  contents: "read",
  issues: "write",
  pull_requests: "write",
  checks: "write"
} as const;

export function buildCheckRunPreview(workItem: WorkItem, headSha = "unknown"): CheckRunPreview {
  const conclusion = workItem.analysis.risk.priority === "urgent" ? "failure" : "neutral";

  return {
    name: "MaintainerOps",
    headSha,
    status: "completed",
    conclusion,
    output: {
      title: `${workItem.analysis.risk.priority.toUpperCase()} risk: ${workItem.title}`,
      summary: workItem.analysis.summary,
      text: formatRecommendations(workItem.analysis.recommendations)
    }
  };
}

export function createGitHubWriteClient(config: AppConfig): GitHubWriteClient | undefined {
  if (!config.github.writesEnabled || !config.github.appId || !config.github.privateKey) {
    return undefined;
  }

  return new OctokitGitHubWriteClient(config);
}

export class OctokitGitHubWriteClient implements GitHubWriteClient {
  private readonly app: App;
  private readonly apiVersion: string;

  constructor(config: AppConfig) {
    if (!config.github.appId || !config.github.privateKey) {
      throw new Error("GitHub App id and private key are required for GitHub writes.");
    }

    this.apiVersion = config.github.apiVersion;
    this.app = new App({
      appId: Number.parseInt(config.github.appId, 10),
      privateKey: config.github.privateKey
    });
  }

  async writeCheckRun(workItem: WorkItem, input: { headSha: string }): Promise<GitHubWriteResult> {
    const octokit = await this.getOctokit(workItem);
    const preview = buildCheckRunPreview(workItem, input.headSha);
    const response = await octokit.request("POST /repos/{owner}/{repo}/check-runs", {
      owner: workItem.repository.owner,
      repo: workItem.repository.name,
      name: preview.name,
      head_sha: preview.headSha,
      status: preview.status,
      conclusion: preview.conclusion,
      output: preview.output,
      headers: this.headers()
    });

    return {
      applied: true,
      githubRequestId: readRequestId(response.headers),
      metadata: { checkRunId: response.data.id, conclusion: preview.conclusion }
    };
  }

  async addLabels(workItem: WorkItem, input: { labels: string[] }): Promise<GitHubWriteResult> {
    if (!workItem.number) {
      throw new Error("GitHub issue or pull request number is required to add labels.");
    }

    const labels = input.labels.filter((label) => label.length > 0);
    if (labels.length === 0) {
      throw new Error("At least one label is required.");
    }

    const octokit = await this.getOctokit(workItem);
    const response = await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
      owner: workItem.repository.owner,
      repo: workItem.repository.name,
      issue_number: workItem.number,
      labels,
      headers: this.headers()
    });

    return {
      applied: true,
      githubRequestId: readRequestId(response.headers),
      metadata: { labels: response.data.map((label) => label.name) }
    };
  }

  async writeIssueComment(workItem: WorkItem, input: { body: string }): Promise<GitHubWriteResult> {
    if (!workItem.number) {
      throw new Error("GitHub issue or pull request number is required to write a comment.");
    }
    if (input.body.trim().length === 0) {
      throw new Error("Comment body is required.");
    }

    const octokit = await this.getOctokit(workItem);
    const response = await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
      owner: workItem.repository.owner,
      repo: workItem.repository.name,
      issue_number: workItem.number,
      body: input.body,
      headers: this.headers()
    });

    return {
      applied: true,
      githubRequestId: readRequestId(response.headers),
      metadata: { commentId: response.data.id, commentUrl: response.data.html_url }
    };
  }

  async createReleaseDraft(
    workItem: WorkItem,
    input: { tagName: string; name?: string | undefined; body?: string | undefined }
  ): Promise<GitHubWriteResult> {
    if (input.tagName.trim().length === 0) {
      throw new Error("Release tag name is required.");
    }

    const octokit = await this.getOctokit(workItem);
    const response = await octokit.request("POST /repos/{owner}/{repo}/releases", {
      owner: workItem.repository.owner,
      repo: workItem.repository.name,
      tag_name: input.tagName,
      name: input.name ?? input.tagName,
      body: input.body ?? "",
      draft: true,
      prerelease: false,
      headers: this.headers()
    });

    return {
      applied: true,
      githubRequestId: readRequestId(response.headers),
      metadata: { releaseId: response.data.id, releaseUrl: response.data.html_url }
    };
  }

  private async getOctokit(workItem: WorkItem): Promise<InstanceType<typeof Octokit>> {
    if (!workItem.repository.installationId) {
      throw new Error("GitHub installation id is required for write actions.");
    }

    return this.app.getInstallationOctokit(workItem.repository.installationId) as Promise<InstanceType<typeof Octokit>>;
  }

  private headers(): Record<string, string> {
    return {
      "X-GitHub-Api-Version": this.apiVersion
    };
  }
}

function formatRecommendations(recommendations: Recommendation[]): string {
  return recommendations
    .map((recommendation) => `- ${recommendation.title}: ${recommendation.description}`)
    .join("\n");
}

function readRequestId(headers: Record<string, string | number | undefined>): string | undefined {
  const value = headers["x-github-request-id"];
  return typeof value === "string" ? value : undefined;
}
