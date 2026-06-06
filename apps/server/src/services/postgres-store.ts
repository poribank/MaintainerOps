import { Pool, type PoolClient } from "pg";
import {
  createAuditLogEntry,
  type AuditLogEntry,
  type GitHubRepositoryRef,
  type WorkItem
} from "@maintainerops/core";
import type { ActionInput, IngestResult, MaintainerStore, QueueFilter } from "./store.js";
import { mergeIngestedWorkItem } from "./store.js";

export class PostgresMaintainerStore implements MaintainerStore {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl });
  }

  async hasDelivery(deliveryId: string): Promise<boolean> {
    const result = await this.pool.query("SELECT 1 FROM webhook_deliveries WHERE delivery_id = $1", [deliveryId]);
    return (result.rowCount ?? 0) > 0;
  }

  async ingest(deliveryId: string, items: WorkItem[], eventName = "unknown"): Promise<IngestResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const delivery = await client.query(
        `INSERT INTO webhook_deliveries (delivery_id, event_name, repository_full_name, processed_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (delivery_id) DO NOTHING`,
        [deliveryId, eventName, items[0]?.repository.fullName ?? null]
      );

      if (delivery.rowCount === 0) {
        await client.query("ROLLBACK");
        return { accepted: false, items: [] };
      }

      const storedItems: WorkItem[] = [];
      for (const item of items) {
        await upsertRepository(client, item.repository);
        storedItems.push(await upsertWorkItem(client, item));
      }

      await client.query("COMMIT");
      return { accepted: true, items: storedItems };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listWorkItems(filter: QueueFilter = {}): Promise<WorkItem[]> {
    const clauses: string[] = [];
    const values: unknown[] = [];

    if (filter.kind) {
      values.push(filter.kind);
      clauses.push(`kind = $${values.length}`);
    }
    if (filter.status) {
      values.push(filter.status);
      clauses.push(`status = $${values.length}`);
    }
    if (filter.repository) {
      values.push(filter.repository);
      clauses.push(`repository_full_name = $${values.length}`);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await this.pool.query(
      `SELECT payload
       FROM work_items
       ${where}
       ORDER BY ((payload->'analysis'->'risk'->>'value')::int) DESC, updated_at DESC`,
      values
    );

    return result.rows.map((row) => row.payload as WorkItem);
  }

  async listRepositories(): Promise<GitHubRepositoryRef[]> {
    const result = await this.pool.query(
      `SELECT id, installation_id, owner, name, full_name, is_private, default_branch
       FROM repositories
       ORDER BY full_name ASC`
    );

    return result.rows.map((row) => {
      const repository: GitHubRepositoryRef = {
        id: Number(row.id),
        owner: row.owner,
        name: row.name,
        fullName: row.full_name,
        private: row.is_private
      };
      if (row.installation_id !== null) repository.installationId = Number(row.installation_id);
      if (row.default_branch) repository.defaultBranch = row.default_branch;
      return repository;
    });
  }

  async getWorkItem(id: string): Promise<WorkItem | undefined> {
    const result = await this.pool.query("SELECT payload FROM work_items WHERE id = $1", [id]);
    return result.rows[0]?.payload as WorkItem | undefined;
  }

  async recordAction(workItemId: string, input: ActionInput): Promise<AuditLogEntry> {
    const item = await this.getWorkItem(workItemId);
    if (!item) {
      throw new Error(`Work item '${workItemId}' was not found.`);
    }

    const dryRun = input.dryRun ?? true;
    const outcome = input.outcome ?? (dryRun ? "recorded" : "approved");
    const entry = createAuditLogEntry({
      actor: input.actor,
      action: input.action,
      repository: item.repository.fullName,
      workItemId: item.id,
      dryRun,
      outcome,
      githubRequestId: input.githubRequestId,
      metadata: input.metadata ?? {}
    });

    if (shouldApplyQueueStatusAction(input.action, dryRun, outcome)) {
      item.status = input.action === "resolve" ? "resolved" : "triaged";
      item.updatedAt = entry.occurredAt;
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO audit_log
         (id, occurred_at, actor, action, repository_full_name, work_item_id, delivery_id, dry_run, github_request_id, outcome, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          entry.id,
          entry.occurredAt,
          entry.actor,
          entry.action,
          entry.repository,
          entry.workItemId ?? null,
          entry.deliveryId ?? null,
          entry.dryRun,
          entry.githubRequestId ?? null,
          entry.outcome,
          entry.metadata
        ]
      );
      if (shouldApplyQueueStatusAction(input.action, dryRun, outcome)) {
        await updateWorkItemPayload(client, item);
      }
      await client.query("COMMIT");
      return entry;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listAuditLog(): Promise<AuditLogEntry[]> {
    const result = await this.pool.query(
      `SELECT id, occurred_at, actor, action, repository_full_name, work_item_id, delivery_id,
              dry_run, github_request_id, outcome, metadata
       FROM audit_log
       ORDER BY occurred_at DESC
       LIMIT 100`
    );

    return result.rows.map((row) => {
      const entry: AuditLogEntry = {
        id: row.id,
        occurredAt: new Date(row.occurred_at).toISOString(),
        actor: row.actor,
        action: row.action,
        repository: row.repository_full_name,
        dryRun: row.dry_run,
        outcome: row.outcome,
        metadata: row.metadata ?? {}
      };
      if (row.work_item_id) entry.workItemId = row.work_item_id;
      if (row.delivery_id) entry.deliveryId = row.delivery_id;
      if (row.github_request_id) entry.githubRequestId = row.github_request_id;
      return entry;
    });
  }

  async seedDemoData(): Promise<void> {
    return undefined;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

function shouldApplyQueueStatusAction(action: string, dryRun: boolean, outcome: AuditLogEntry["outcome"]): boolean {
  return (action === "triage" || action === "resolve") && !dryRun && outcome !== "failed" && outcome !== "rejected";
}

async function upsertRepository(client: PoolClient, repository: GitHubRepositoryRef): Promise<void> {
  const hasRepositoryId = repository.id !== undefined;
  if (repository.installationId) {
    await client.query(
      `INSERT INTO installations (id, account_login)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET account_login = EXCLUDED.account_login, updated_at = now()`,
      [repository.installationId, repository.owner]
    );
  }

  await client.query(
    `INSERT INTO repositories (id, installation_id, owner, name, full_name, is_private, default_branch)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (full_name) DO UPDATE SET
       id = CASE WHEN $8 THEN EXCLUDED.id ELSE repositories.id END,
       installation_id = COALESCE(EXCLUDED.installation_id, repositories.installation_id),
       owner = EXCLUDED.owner,
       name = EXCLUDED.name,
       is_private = EXCLUDED.is_private,
       default_branch = COALESCE(EXCLUDED.default_branch, repositories.default_branch),
       updated_at = now()`,
    [
      repository.id ?? stableRepositoryId(repository.fullName),
      repository.installationId ?? null,
      repository.owner,
      repository.name,
      repository.fullName,
      repository.private,
      repository.defaultBranch ?? null,
      hasRepositoryId
    ]
  );
}

async function upsertWorkItem(client: PoolClient, item: WorkItem): Promise<WorkItem> {
  const existing = await client.query("SELECT payload FROM work_items WHERE id = $1", [item.id]);
  const itemToStore =
    existing.rowCount && existing.rows[0]?.payload
      ? mergeIngestedWorkItem(existing.rows[0].payload as WorkItem, item)
      : item;

  await client.query(
    `INSERT INTO work_items (id, kind, status, repository_full_name, title, external_id, payload, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       kind = EXCLUDED.kind,
       status = EXCLUDED.status,
       repository_full_name = EXCLUDED.repository_full_name,
       title = EXCLUDED.title,
       external_id = EXCLUDED.external_id,
       payload = EXCLUDED.payload,
      updated_at = EXCLUDED.updated_at`,
    [
      itemToStore.id,
      itemToStore.kind,
      itemToStore.status,
      itemToStore.repository.fullName,
      itemToStore.title,
      itemToStore.externalId,
      itemToStore,
      itemToStore.createdAt,
     itemToStore.updatedAt
    ]
  );
  return itemToStore;
}

async function updateWorkItemPayload(client: PoolClient, item: WorkItem): Promise<void> {
  await client.query(
    `UPDATE work_items
     SET status = $2,
         payload = $3,
         updated_at = $4
     WHERE id = $1`,
    [item.id, item.status, item, item.updatedAt]
  );
}

function stableRepositoryId(fullName: string): number {
  let hash = 0;
  for (const char of fullName) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}
