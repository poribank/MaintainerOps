import type { AuditLogEntry } from "./types.js";

export interface CreateAuditLogInput {
  actor: string;
  action: string;
  repository: string;
  workItemId?: string | undefined;
  deliveryId?: string | undefined;
  dryRun?: boolean;
  githubRequestId?: string | undefined;
  outcome?: AuditLogEntry["outcome"];
  metadata?: Record<string, unknown>;
  now?: Date;
}

export function createAuditLogEntry(input: CreateAuditLogInput): AuditLogEntry {
  const occurredAt = (input.now ?? new Date()).toISOString();
  const id = `audit:${occurredAt}:${input.repository}:${input.action}`.replace(/\s+/g, "-");

  const entry: AuditLogEntry = {
    id,
    occurredAt,
    actor: input.actor,
    action: input.action,
    repository: input.repository,
    dryRun: input.dryRun ?? true,
    outcome: input.outcome ?? "recorded",
    metadata: input.metadata ?? {}
  };

  if (input.workItemId) entry.workItemId = input.workItemId;
  if (input.deliveryId) entry.deliveryId = input.deliveryId;
  if (input.githubRequestId) entry.githubRequestId = input.githubRequestId;

  return entry;
}
