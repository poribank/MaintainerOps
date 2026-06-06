import {
  createAuditLogEntry,
  evaluateSecurityPosture,
  scoreWorkItem,
  type AuditLogEntry,
  type GitHubRepositoryRef,
  type Recommendation,
  type WorkItem,
  type WorkItemKind,
  type WorkItemStatus
} from "@maintainerops/core";

export interface QueueFilter {
  kind?: WorkItemKind | undefined;
  status?: WorkItemStatus | undefined;
  repository?: string | undefined;
}

export interface ActionInput {
  actor: string;
  action: string;
  dryRun?: boolean;
  outcome?: AuditLogEntry["outcome"];
  githubRequestId?: string | undefined;
  metadata?: Record<string, unknown>;
}

export interface IngestResult {
  accepted: boolean;
  items: WorkItem[];
}

export type Awaitable<T> = T | Promise<T>;

export interface MaintainerStore {
  hasDelivery(deliveryId: string): Awaitable<boolean>;
  ingest(deliveryId: string, items: WorkItem[], eventName?: string): Awaitable<IngestResult>;
  listWorkItems(filter?: QueueFilter): Awaitable<WorkItem[]>;
  listRepositories(): Awaitable<GitHubRepositoryRef[]>;
  getWorkItem(id: string): Awaitable<WorkItem | undefined>;
  recordAction(workItemId: string, input: ActionInput): Awaitable<AuditLogEntry>;
  listAuditLog(): Awaitable<AuditLogEntry[]>;
  seedDemoData?(now?: Date): Awaitable<void>;
  close?(): Awaitable<void>;
}

export class InMemoryMaintainerStore implements MaintainerStore {
  private readonly deliveries = new Set<string>();
  private readonly workItems = new Map<string, WorkItem>();
  private readonly repositories = new Map<string, GitHubRepositoryRef>();
  private readonly auditLog: AuditLogEntry[] = [];

  hasDelivery(deliveryId: string): boolean {
    return this.deliveries.has(deliveryId);
  }

  ingest(deliveryId: string, items: WorkItem[]): IngestResult {
    if (this.deliveries.has(deliveryId)) {
      return { accepted: false, items: [] };
    }

    this.deliveries.add(deliveryId);
    const storedItems: WorkItem[] = [];

    for (const item of items) {
      const incoming = cloneWorkItem(item);
      const existing = this.workItems.get(incoming.id);

      if (existing) {
        const merged = mergeIngestedWorkItem(existing, incoming);
        this.workItems.set(incoming.id, merged);
        this.repositories.set(merged.repository.fullName, cloneRepository(merged.repository));
        storedItems.push(cloneWorkItem(merged));
      } else {
        this.workItems.set(incoming.id, incoming);
        this.repositories.set(incoming.repository.fullName, cloneRepository(incoming.repository));
        storedItems.push(cloneWorkItem(incoming));
      }
    }

    return { accepted: true, items: storedItems };
  }

  listWorkItems(filter: QueueFilter = {}): WorkItem[] {
    return Array.from(this.workItems.values())
      .filter((item) => (filter.kind ? item.kind === filter.kind : true))
      .filter((item) => (filter.status ? item.status === filter.status : true))
      .filter((item) => (filter.repository ? item.repository.fullName === filter.repository : true))
      .sort((left, right) => {
        const riskDelta = right.analysis.risk.value - left.analysis.risk.value;
        if (riskDelta !== 0) return riskDelta;
        return right.updatedAt.localeCompare(left.updatedAt);
      })
      .map(cloneWorkItem);
  }

  listRepositories(): GitHubRepositoryRef[] {
    return Array.from(this.repositories.values())
      .sort((left, right) => left.fullName.localeCompare(right.fullName))
      .map(cloneRepository);
  }

  getWorkItem(id: string): WorkItem | undefined {
    const item = this.workItems.get(id);
    return item ? cloneWorkItem(item) : undefined;
  }

  recordAction(workItemId: string, input: ActionInput): AuditLogEntry {
    const item = this.workItems.get(workItemId);
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
    const storedEntry = cloneAuditLogEntry(entry);
    this.auditLog.unshift(storedEntry);

    if (shouldApplyQueueStatusAction(input.action, dryRun, outcome)) {
      item.status = input.action === "resolve" ? "resolved" : "triaged";
      item.updatedAt = entry.occurredAt;
    }

    return cloneAuditLogEntry(storedEntry);
  }

  listAuditLog(): AuditLogEntry[] {
    return this.auditLog.map(cloneAuditLogEntry);
  }

  seedDemoData(now = new Date()): void {
    const repository: GitHubRepositoryRef = {
      id: 1,
      owner: "opensource",
      name: "critical-runtime",
      fullName: "opensource/critical-runtime",
      private: false,
      defaultBranch: "main"
    };

    const security = evaluateSecurityPosture({
      files: ["README.md", "package.json", ".github/CODEOWNERS"],
      scorecardScore: 6.4,
      codeownersErrors: 1,
      branchProtectionEnabled: false,
      rulesetsEnabled: false,
      securityInsightsPresent: false,
      dependabotAlerts: 2
    });

    const recommendations: Recommendation[] = [
      {
        id: "demo:label-security",
        action: "add_label",
        title: "Add security label",
        description: "The report mentions token leakage and needs private maintainer review.",
        confidence: 0.9,
        labels: ["security"],
        requiresApproval: true
      }
    ];

    const items: WorkItem[] = [
      {
        id: "pull_request:opensource/critical-runtime:1842",
        kind: "pull_request",
        status: "open",
        repository,
        title: "Harden release workflow permissions",
        url: "https://github.com/opensource/critical-runtime/pull/1842",
        number: 1842,
        externalId: "pull_request:opensource/critical-runtime:1842",
        actor: { login: "first-time-contributor" },
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 8).toISOString(),
        updatedAt: now.toISOString(),
        labels: ["security"],
        sourceDeliveryIds: ["demo-pr"],
        analysis: {
          summary: "Security-sensitive workflow files changed by a new contributor.",
          risk: scoreWorkItem({
            kind: "pull_request",
            changedFiles: [".github/workflows/release.yml", "package-lock.json"],
            newContributor: true,
            missingTests: true,
            releaseImpact: true
          }),
          findings: [
            {
              id: "demo:workflow-change",
              title: "Release workflow changed",
              severity: "high",
              source: "triage",
              description: "The PR changes files that can affect release credentials and provenance."
            }
          ],
          recommendations: [
            {
              id: "demo:check-run",
              action: "write_check",
              title: "Publish MaintainerOps check",
              description: "Use a check run to summarize release and security review requirements.",
              confidence: 0.88,
              requiresApproval: false
            }
          ]
        }
      },
      {
        id: "issue:opensource/critical-runtime:932",
        kind: "issue",
        status: "open",
        repository,
        title: "Crash when auth token is refreshed",
        url: "https://github.com/opensource/critical-runtime/issues/932",
        number: 932,
        externalId: "issue:opensource/critical-runtime:932",
        actor: { login: "user-reporter" },
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 36).toISOString(),
        updatedAt: now.toISOString(),
        labels: [],
        sourceDeliveryIds: ["demo-issue"],
        analysis: {
          summary: "Issue likely needs bug and reproduction triage.",
          risk: scoreWorkItem({ kind: "issue", securitySensitive: true, staleDays: 2 }),
          findings: [],
          recommendations
        }
      },
      {
        id: "policy:opensource/critical-runtime:security-posture",
        kind: "policy",
        status: "open",
        repository,
        title: "Security policy compliance needs attention",
        externalId: "policy:opensource/critical-runtime:security-posture",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        labels: ["security"],
        sourceDeliveryIds: ["demo-policy"],
        analysis: {
          summary: "Repository policy checks found missing security metadata and branch protection gaps.",
          risk: scoreWorkItem({
            kind: "policy",
            scorecardScore: 6.4,
            codeownersMissing: false,
            securitySensitive: true
          }),
          findings: security.findings,
          recommendations: security.recommendations
        }
      }
    ];

    this.ingest("demo-seed", items);
  }
}

function shouldApplyQueueStatusAction(action: string, dryRun: boolean, outcome: AuditLogEntry["outcome"]): boolean {
  return (action === "triage" || action === "resolve") && !dryRun && outcome !== "failed" && outcome !== "rejected";
}

export function mergeIngestedWorkItem(existing: WorkItem, incoming: WorkItem): WorkItem {
  return {
    ...incoming,
    createdAt: existing.createdAt,
    repository: mergeRepositoryRef(existing.repository, incoming.repository),
    status: nextIngestedStatus(existing.status, incoming.status),
    sourceDeliveryIds: Array.from(new Set([...existing.sourceDeliveryIds, ...incoming.sourceDeliveryIds]))
  };
}

function mergeRepositoryRef(existing: GitHubRepositoryRef, incoming: GitHubRepositoryRef): GitHubRepositoryRef {
  const repository: GitHubRepositoryRef = { ...incoming };
  if (repository.id === undefined && existing.id !== undefined) repository.id = existing.id;
  if (repository.installationId === undefined && existing.installationId !== undefined) {
    repository.installationId = existing.installationId;
  }
  if (repository.defaultBranch === undefined && existing.defaultBranch !== undefined) {
    repository.defaultBranch = existing.defaultBranch;
  }
  return repository;
}

function nextIngestedStatus(existing: WorkItemStatus, incoming: WorkItemStatus): WorkItemStatus {
  if (incoming === "resolved") return "resolved";
  if (existing === "resolved" && incoming === "open") return "open";
  return existing;
}

function cloneWorkItem(item: WorkItem): WorkItem {
  return structuredClone(item);
}

function cloneRepository(repository: GitHubRepositoryRef): GitHubRepositoryRef {
  return structuredClone(repository);
}

function cloneAuditLogEntry(entry: AuditLogEntry): AuditLogEntry {
  return structuredClone(entry);
}
