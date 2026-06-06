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
          ...input.metadata,
          mode: "local-queue",
          action: input.action
        }
      };
    }

    if (!isGitHubWriteAction(input.action)) {
      return {
        outcome: "failed",
        dryRun: input.dryRun,
        metadata: {
          reason: `Unsupported write action '${input.action}'.`,
          action: input.action
        }
      };
    }

    if (input.dryRun) {
      return {
        outcome: "recorded",
        dryRun: true,
        metadata: {
          ...input.metadata,
          mode: "dry-run",
          action: input.action
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
          headSha: requireGitCommitSha(input.metadata, "headSha")
        });
      case "add_label":
        return this.github!.addLabels(workItem, {
          labels: requireStringArray(input.metadata, "labels")
        });
      case "write_pr_comment":
        requireWorkItemKind(workItem, input.action, "pull_request");
        return this.github!.writeIssueComment(workItem, {
          body: requireString(input.metadata, "body")
        });
      case "write_issue_comment":
        requireWorkItemKind(workItem, input.action, "issue");
        return this.github!.writeIssueComment(workItem, {
          body: requireString(input.metadata, "body")
        });
      case "create_release_draft":
        requireWorkItemKind(workItem, input.action, "release");
        return this.github!.createReleaseDraft(workItem, {
          tagName: requireTrimmedString(input.metadata, "tagName"),
          name: optionalTrimmedString(input.metadata, "name"),
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

function isGitHubWriteAction(action: string): boolean {
  return (
    action === "write_check" ||
    action === "add_label" ||
    action === "write_pr_comment" ||
    action === "write_issue_comment" ||
    action === "create_release_draft"
  );
}

function requireWorkItemKind(workItem: WorkItem, action: string, kind: WorkItem["kind"]): void {
  if (workItem.kind !== kind) {
    throw new Error(`Action '${action}' requires a ${kind} work item.`);
  }
}

function requireString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Action metadata '${key}' is required.`);
  }
  return value;
}

function requireTrimmedString(metadata: Record<string, unknown>, key: string): string {
  return requireString(metadata, key).trim();
}

function requireGitCommitSha(metadata: Record<string, unknown>, key: string): string {
  const value = requireTrimmedString(metadata, key);
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(value)) {
    throw new Error(`Action metadata '${key}' must be a git commit SHA.`);
  }
  return value;
}

function optionalString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalTrimmedString(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function requireStringArray(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
    throw new Error(`Action metadata '${key}' must be a non-empty string array.`);
  }
  if (value.length === 0) {
    throw new Error(`Action metadata '${key}' must include at least one value.`);
  }
  return value.map((entry) => entry.trim());
}
