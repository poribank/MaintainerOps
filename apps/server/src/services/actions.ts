import type { WorkItem } from "@maintainerops/core";
import type { GitHubWriteClient, GitHubWriteResult } from "./github.js";

export interface ExecuteActionInput {
  action: string;
  dryRun: boolean;
  metadata: Record<string, unknown>;
}

export interface ActionExecutionResult {
  outcome: "recorded" | "applied" | "failed";
  dryRun: boolean;
  githubRequestId?: string;
  metadata: Record<string, unknown>;
}

export class ActionExecutor {
  constructor(private readonly github?: GitHubWriteClient) {}

  async execute(workItem: WorkItem, input: ExecuteActionInput): Promise<ActionExecutionResult> {
    if (isLocalQueueAction(input.action)) {
      return {
        outcome: input.dryRun ? "recorded" : "applied",
        dryRun: input.dryRun,
        metadata: {
          mode: "local-queue",
          action: input.action,
          ...input.metadata
        }
      };
    }

    if (input.dryRun) {
      return {
        outcome: "recorded",
        dryRun: true,
        metadata: {
          mode: "dry-run",
          action: input.action,
          ...input.metadata
        }
      };
    }

    if (!this.github) {
      return {
        outcome: "failed",
        dryRun: false,
        metadata: {
          reason: "GitHub writes are disabled or GitHub App credentials are missing.",
          action: input.action
        }
      };
    }

    try {
      const result = await this.executeGitHubAction(workItem, input);
      const output: ActionExecutionResult = {
        outcome: result.applied ? "applied" : "recorded",
        dryRun: false,
        metadata: result.metadata
      };
      if (result.githubRequestId) output.githubRequestId = result.githubRequestId;
      return output;
    } catch (error) {
      return {
        outcome: "failed",
        dryRun: false,
        metadata: {
          reason: error instanceof Error ? error.message : "Unknown action execution error.",
          action: input.action
        }
      };
    }
  }

  private executeGitHubAction(workItem: WorkItem, input: ExecuteActionInput): Promise<GitHubWriteResult> {
    switch (input.action) {
      case "write_check":
        return this.github!.writeCheckRun(workItem, {
          headSha: requireString(input.metadata, "headSha")
        });
      case "add_label":
        return this.github!.addLabels(workItem, {
          labels: requireStringArray(input.metadata, "labels")
        });
      case "write_pr_comment":
      case "write_issue_comment":
        return this.github!.writeIssueComment(workItem, {
          body: requireString(input.metadata, "body")
        });
      case "create_release_draft":
        return this.github!.createReleaseDraft(workItem, {
          tagName: requireString(input.metadata, "tagName"),
          name: optionalString(input.metadata, "name"),
          body: optionalString(input.metadata, "body")
        });
      default:
        throw new Error(`Unsupported write action '${input.action}'.`);
    }
  }
}

function isLocalQueueAction(action: string): boolean {
  return action === "triage" || action === "resolve";
}

function requireString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Action metadata '${key}' is required.`);
  }
  return value;
}

function optionalString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requireStringArray(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new Error(`Action metadata '${key}' must be a non-empty string array.`);
  }
  if (value.length === 0) {
    throw new Error(`Action metadata '${key}' must include at least one value.`);
  }
  return value;
}
