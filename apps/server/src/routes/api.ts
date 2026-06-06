import type { FastifyInstance } from "fastify";
import {
  canSendContentToAi,
  parsePolicy,
  validatePolicy,
  type WorkItemKind,
  type WorkItemStatus
} from "@maintainerops/core";
import type { AppConfig } from "../config.js";
import { buildCheckRunPreview, MINIMUM_GITHUB_APP_PERMISSIONS } from "../services/github.js";
import { isRecord, parseJsonBody } from "../services/body.js";
import type { ActionExecutor } from "../services/actions.js";
import type { MaintainerStore } from "../services/store.js";
import { assertRepositoryFullName, resolveSafePath, type SecurityScannerRunner } from "../services/scanners.js";
import type { JobQueue } from "../services/jobs.js";
import type { AiAssistanceKind, MaintainerAiAssistant } from "../services/ai-assistant.js";

export function registerApiRoutes(
  app: FastifyInstance,
  config: AppConfig,
  store: MaintainerStore,
  actions: ActionExecutor,
  scanners: SecurityScannerRunner,
  jobs: JobQueue,
  aiAssistant: MaintainerAiAssistant
): void {
  app.get("/healthz", async () => ({ ok: true }));
  app.get("/readyz", async () => ({ ok: true, store: config.storage.driver, queue: config.queue.driver }));

  app.get("/api/github-app/permissions", async () => ({
    minimum: MINIMUM_GITHUB_APP_PERMISSIONS,
    optional: {
      rulesets: "read",
      code_scanning_alerts: "read",
      secret_scanning_alerts: "read",
      security_events: "read",
      contents: "write for release drafts only"
    }
  }));

  app.get("/api/queue", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const allItems = await store.listWorkItems({
      kind: parseKind(query.kind),
      status: parseStatus(query.status),
      repository: query.repository
    });
    const limit = parseOptionalListLimit(query.limit);
    const items = limit ? allItems.slice(0, limit) : allItems;

    return { total: allItems.length, count: items.length, limit, items };
  });

  app.get("/api/repositories", async () => ({
    repositories: await store.listRepositories()
  }));

  app.get("/api/work-items/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const item = await store.getWorkItem(params.id);
    if (!item) {
      return reply.code(404).send({ error: "Work item not found." });
    }

    return { item, checkRunPreview: buildCheckRunPreview(item) };
  });

  app.post("/api/work-items/:id/actions", async (request, reply) => {
    const params = request.params as { id: string };
    const body = parseJsonBody(request.body);
    const action = readString(body.action);
    const actor = readString(body.actor) ?? "local-admin";
    const metadata = isRecord(body.metadata) ? body.metadata : {};

    if (!action) {
      return reply.code(400).send({ error: "Action is required." });
    }
    if (!isSupportedAction(action)) {
      return reply.code(400).send({ error: `Unsupported action '${action}'.` });
    }

    try {
      const item = await store.getWorkItem(params.id);
      if (!item) {
        return reply.code(404).send({ error: "Work item not found." });
      }

      const execution = await actions.execute(item, {
        action,
        dryRun: body.dryRun !== false,
        metadata
      });
      const entry = await store.recordAction(params.id, {
        action,
        actor,
        dryRun: execution.dryRun,
        outcome: execution.outcome,
        githubRequestId: execution.githubRequestId,
        metadata: execution.metadata
      });
      return reply.code(execution.outcome === "failed" ? 400 : 202).send({ audit: entry, execution });
    } catch (error) {
      return reply.code(404).send({ error: error instanceof Error ? error.message : "Action failed." });
    }
  });

  app.post("/api/policies/validate", async (request, reply) => {
    const body = parseJsonBody(request.body);
    const source = readString(body.source);
    if (!source) {
      return reply.code(400).send({ error: "Policy source is required." });
    }

    return validatePolicy(source);
  });

  app.get("/api/audit-log", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const allEntries = await store.listAuditLog();
    const limit = parseOptionalListLimit(query.limit);
    const entries = limit ? allEntries.slice(0, limit) : allEntries;
    return { total: allEntries.length, count: entries.length, limit, entries };
  });

  app.get("/api/pilot/metrics", async () => {
    const items = await store.listWorkItems();
    const audit = await store.listAuditLog();
    const jobItems = await jobs.list(100);
    const repositories = new Set(items.map((item) => item.repository.fullName));
    const open = items.filter((item) => item.status === "open");

    return {
      generatedAt: new Date().toISOString(),
      repositories: repositories.size,
      workItems: {
        total: items.length,
        open: open.length,
        triaged: items.filter((item) => item.status === "triaged").length,
        resolved: items.filter((item) => item.status === "resolved").length,
        pullRequests: items.filter((item) => item.kind === "pull_request").length,
        issues: items.filter((item) => item.kind === "issue").length,
        releases: items.filter((item) => item.kind === "release").length,
        securityOrPolicy: items.filter((item) => item.kind === "security" || item.kind === "policy").length
      },
      recommendations: {
        total: items.reduce((sum, item) => sum + item.analysis.recommendations.length, 0),
        approvalGated: items.reduce(
          (sum, item) => sum + item.analysis.recommendations.filter((recommendation) => recommendation.requiresApproval).length,
          0
        )
      },
      audit: {
        total: audit.length,
        failed: audit.filter((entry) => entry.outcome === "failed").length,
        applied: audit.filter((entry) => entry.outcome === "applied").length,
        aiAssists: audit.filter((entry) => entry.action === "ai_assist").length,
        aiRawContentTransfers: audit.filter(
          (entry) => entry.action === "ai_assist" && entry.metadata.usedRawContent === true
        ).length
      },
      jobs: {
        total: jobItems.length,
        completed: jobItems.filter((job) => job.status === "completed").length,
        failed: jobItems.filter((job) => job.status === "failed").length
      }
    };
  });

  app.post("/api/work-items/:id/ai-assist", async (request, reply) => {
    const params = request.params as { id: string };
    const body = parseJsonBody(request.body);
    const item = await store.getWorkItem(params.id);

    if (!item) {
      return reply.code(404).send({ error: "Work item not found." });
    }

    const kind = parseAiKind(readString(body.kind)) ?? defaultAiKind(item.kind);
    const includeRawContent = body.includeRawContent === true;
    const rawContent = readString(body.rawContent);
    const actor = readString(body.actor) ?? "local-admin";
    const policySource = readString(body.policySource);

    if (includeRawContent) {
      const policyResult = evaluateRawContentPolicy(policySource, config.ai.provider);
      if (!policyResult.allowed) {
        await store.recordAction(item.id, {
          actor,
          action: "ai_assist",
          dryRun: true,
          outcome: "failed",
          metadata: {
            kind,
            requestedRawContent: true,
            reason: policyResult.reason
          }
        });
        return reply.code(403).send({ error: policyResult.reason });
      }

      if (!rawContent) {
        const reason = "rawContent is required when includeRawContent=true.";
        await store.recordAction(item.id, {
          actor,
          action: "ai_assist",
          dryRun: true,
          outcome: "failed",
          metadata: {
            kind,
            requestedRawContent: true,
            reason
          }
        });
        return reply.code(400).send({ error: reason });
      }
    }

    try {
      const assistance = await aiAssistant.assist(item, { kind, includeRawContent, rawContent });
      const audit = await store.recordAction(item.id, {
        actor,
        action: "ai_assist",
        dryRun: true,
        outcome: "recorded",
        metadata: {
          kind,
          provider: assistance.provider,
          model: assistance.model,
          enabled: assistance.enabled,
          requestedRawContent: includeRawContent,
          usedRawContent: assistance.usedRawContent,
          redacted: assistance.redacted
        }
      });
      return { assistance, audit };
    } catch (error) {
      await store.recordAction(item.id, {
        actor,
        action: "ai_assist",
        dryRun: true,
        outcome: "failed",
        metadata: {
          kind,
          requestedRawContent: includeRawContent,
          reason: error instanceof Error ? error.message : "AI assistance failed."
        }
      });
      return reply.code(400).send({ error: error instanceof Error ? error.message : "AI assistance failed." });
    }
  });

  app.get("/api/jobs", async (request) => {
    const query = request.query as Record<string, string | undefined>;
    const items = await jobs.list(parseJobListLimit(query.limit));
    return { total: items.length, items };
  });

  app.get("/api/jobs/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const job = await jobs.get(params.id);
    if (!job) {
      return reply.code(404).send({ error: "Job not found." });
    }
    return { job };
  });

  app.post("/api/jobs/scans/scorecard", async (request, reply) => {
    const body = parseJsonBody(request.body);
    const repository = await resolveRepositoryInput(body, store);
    if (!repository) {
      return reply.code(400).send({ error: "Repository or workItemId is required." });
    }
    try {
      assertRepositoryFullName(repository);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid repository." });
    }
    const job = await jobs.enqueue("scan.scorecard", { repository });
    return reply.code(202).send({ job });
  });

  app.post("/api/jobs/scans/osv", async (request, reply) => {
    const body = parseJsonBody(request.body);
    const targetPath = readString(body.path) ?? ".";
    try {
      resolveSafePath(config.scanners.workspaceRoot, targetPath);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid scan path." });
    }
    const job = await jobs.enqueue("scan.osv", { path: targetPath });
    return reply.code(202).send({ job });
  });

  app.post("/api/scans/scorecard", async (request, reply) => {
    const body = parseJsonBody(request.body);

    try {
      const repositoryFullName = await resolveRepositoryInput(body, store);
      if (!repositoryFullName) {
        return reply.code(400).send({ error: "Repository or workItemId is required." });
      }

      return await scanners.runScorecard(repositoryFullName);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Scorecard scan failed." });
    }
  });

  app.post("/api/scans/osv", async (request, reply) => {
    const body = parseJsonBody(request.body);
    const targetPath = readString(body.path) ?? ".";

    try {
      return await scanners.runOsvScanner(targetPath);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "OSV scan failed." });
    }
  });
}

async function resolveRepositoryInput(
  body: Record<string, unknown>,
  store: MaintainerStore
): Promise<string | undefined> {
  const repository = readString(body.repository);
  const workItemId = readString(body.workItemId);
  return repository ?? (workItemId ? (await store.getWorkItem(workItemId))?.repository.fullName : undefined);
}

function parseKind(value: string | undefined): WorkItemKind | undefined {
  const allowed: WorkItemKind[] = ["pull_request", "issue", "release", "security", "policy"];
  return allowed.includes(value as WorkItemKind) ? (value as WorkItemKind) : undefined;
}

function parseStatus(value: string | undefined): WorkItemStatus | undefined {
  const allowed: WorkItemStatus[] = ["open", "triaged", "snoozed", "resolved"];
  return allowed.includes(value as WorkItemStatus) ? (value as WorkItemStatus) : undefined;
}

function parseAiKind(value: string | undefined): AiAssistanceKind | undefined {
  const allowed: AiAssistanceKind[] = ["pr_review", "issue_triage", "release_readiness", "security_review"];
  return allowed.includes(value as AiAssistanceKind) ? (value as AiAssistanceKind) : undefined;
}

function defaultAiKind(kind: WorkItemKind): AiAssistanceKind {
  switch (kind) {
    case "pull_request":
      return "pr_review";
    case "issue":
      return "issue_triage";
    case "release":
      return "release_readiness";
    case "security":
    case "policy":
      return "security_review";
  }
}

function isSupportedAction(action: string): boolean {
  return [
    "triage",
    "resolve",
    "write_check",
    "add_label",
    "write_issue_comment",
    "write_pr_comment",
    "create_release_draft"
  ].includes(action);
}

function evaluateRawContentPolicy(
  policySource: string | undefined,
  configuredProvider: AppConfig["ai"]["provider"]
): { allowed: true } | { allowed: false; reason: string } {
  if (!policySource) {
    return {
      allowed: false,
      reason: "Raw content AI assistance requires an explicit repository policy source."
    };
  }

  try {
    const policy = parsePolicy(policySource);
    if (!canSendContentToAi(policy)) {
      return {
        allowed: false,
        reason: "Repository policy does not allow raw content transfer to AI."
      };
    }

    if (policy.ai.provider !== configuredProvider) {
      return {
        allowed: false,
        reason: `Repository policy allows provider '${policy.ai.provider}', but server is configured for '${configuredProvider}'.`
      };
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      reason: error instanceof Error ? `Invalid repository policy: ${error.message}` : "Invalid repository policy."
    };
  }
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseJobListLimit(value: string | undefined): number {
  if (!value) return 50;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(parsed, 1), 100);
}

function parseOptionalListLimit(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(parsed, 1), 100);
}
