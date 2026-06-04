import type { Analysis, GitHubActorRef, GitHubRepositoryRef, WorkItem, WorkItemKind } from "./types.js";
import { scoreWorkItem } from "./scoring.js";
import { recommendIssueLabels } from "./triage.js";

export interface NormalizedWebhookInput {
  eventName: string;
  deliveryId: string;
  payload: Record<string, unknown>;
  receivedAt?: Date;
}

export function normalizeGitHubWebhook(input: NormalizedWebhookInput): WorkItem[] {
  const repository = readRepository(input.payload);
  if (!repository) return [];

  const now = (input.receivedAt ?? new Date()).toISOString();
  const actor = readActor(input.payload.sender);

  switch (input.eventName) {
    case "pull_request":
      return normalizePullRequest(input, repository, actor, now);
    case "issues":
      return normalizeIssue(input, repository, actor, now);
    case "release":
      return normalizeRelease(input, repository, actor, now);
    case "dependabot_alert":
    case "code_scanning_alert":
    case "secret_scanning_alert":
    case "repository_advisory":
      return [createSecurityWorkItem(input, repository, actor, now)];
    default:
      return [];
  }
}

function normalizePullRequest(
  input: NormalizedWebhookInput,
  repository: GitHubRepositoryRef,
  actor: GitHubActorRef | undefined,
  now: string
): WorkItem[] {
  const pullRequest = asRecord(input.payload.pull_request);
  if (!pullRequest) return [];

  const number = readNumber(input.payload.number) ?? readNumber(pullRequest.number);
  const title = readString(pullRequest.title) ?? `Pull request #${number ?? "unknown"}`;
  const labels = readLabels(pullRequest.labels);
  const analysis: Analysis = {
    summary: "Pull request needs maintainer review.",
    risk: scoreWorkItem({
      kind: "pull_request",
      labels,
      newContributor: readString(pullRequest.author_association) === "FIRST_TIME_CONTRIBUTOR"
    }),
    findings: [],
    recommendations: [
      {
        id: "pr:write-check",
        action: "write_check",
        title: "Publish MaintainerOps check",
        description: "Summarize risk factors and review suggestions in a check run.",
        confidence: 0.85,
        requiresApproval: false
      }
    ]
  };

  return [
    createWorkItem({
      kind: "pull_request",
      repository,
      actor,
      number,
      title,
      url: readString(pullRequest.html_url),
      externalId: `pull_request:${repository.fullName}:${number ?? readString(pullRequest.node_id) ?? input.deliveryId}`,
      deliveryId: input.deliveryId,
      now,
      labels,
      analysis
    })
  ];
}

function normalizeIssue(
  input: NormalizedWebhookInput,
  repository: GitHubRepositoryRef,
  actor: GitHubActorRef | undefined,
  now: string
): WorkItem[] {
  const issue = asRecord(input.payload.issue);
  if (!issue || asRecord(issue.pull_request)) return [];

  const number = readNumber(issue.number);
  const title = readString(issue.title) ?? `Issue #${number ?? "unknown"}`;
  const labels = readLabels(issue.labels);
  const recommendations = recommendIssueLabels({
    title,
    body: readString(issue.body),
    labels,
    authorAssociation: readString(issue.author_association)
  });

  const analysis: Analysis = {
    summary: "Issue needs triage.",
    risk: scoreWorkItem({
      kind: "issue",
      labels,
      securitySensitive: recommendations.some((recommendation) => recommendation.labels?.includes("security"))
    }),
    findings: [],
    recommendations
  };

  return [
    createWorkItem({
      kind: "issue",
      repository,
      actor,
      number,
      title,
      url: readString(issue.html_url),
      externalId: `issue:${repository.fullName}:${number ?? readString(issue.node_id) ?? input.deliveryId}`,
      deliveryId: input.deliveryId,
      now,
      labels,
      analysis
    })
  ];
}

function normalizeRelease(
  input: NormalizedWebhookInput,
  repository: GitHubRepositoryRef,
  actor: GitHubActorRef | undefined,
  now: string
): WorkItem[] {
  const release = asRecord(input.payload.release);
  if (!release) return [];

  const title = readString(release.name) ?? readString(release.tag_name) ?? "Release";
  const analysis: Analysis = {
    summary: "Release needs readiness validation.",
    risk: scoreWorkItem({ kind: "release", releaseImpact: true }),
    findings: [],
    recommendations: [
      {
        id: "release:validate",
        action: "review_required",
        title: "Validate release readiness",
        description: "Check release blockers before publishing or promoting this release.",
        confidence: 0.82,
        requiresApproval: false
      }
    ]
  };

  return [
    createWorkItem({
      kind: "release",
      repository,
      actor,
      number: undefined,
      title,
      url: readString(release.html_url),
      externalId: `release:${repository.fullName}:${readString(release.tag_name) ?? input.deliveryId}`,
      deliveryId: input.deliveryId,
      now,
      labels: [],
      analysis
    })
  ];
}

function createSecurityWorkItem(
  input: NormalizedWebhookInput,
  repository: GitHubRepositoryRef,
  actor: GitHubActorRef | undefined,
  now: string
): WorkItem {
  const alert = asRecord(input.payload.alert) ?? asRecord(input.payload.security_advisory) ?? input.payload;
  const title = readString(alert.title) ?? `${input.eventName.replaceAll("_", " ")} requires review`;
  const severity = readSeverity(alert);
  const alertId = readIdentifier(alert.number) ?? readIdentifier(alert.id) ?? input.deliveryId;

  return createWorkItem({
    kind: "security",
    repository,
    actor,
    number: undefined,
    title,
    url: readString(alert.html_url),
    externalId: `security:${repository.fullName}:${input.eventName}:${alertId}`,
    deliveryId: input.deliveryId,
    now,
    labels: ["security"],
    analysis: {
      summary: "Security signal needs maintainer review.",
      risk: scoreWorkItem({ kind: "security", unresolvedAdvisory: severity === "critical" }),
      findings: [
        {
          id: `security:${input.eventName}`,
          title,
          severity,
          source: "security",
          description: "GitHub reported a security alert for this repository."
        }
      ],
      recommendations: [
        {
          id: "security:review",
          action: "review_required",
          title: "Review security alert",
          description: "A maintainer should inspect the alert in GitHub before release.",
          confidence: 0.95,
          requiresApproval: false
        }
      ]
    }
  });
}

function createWorkItem(input: {
  kind: WorkItemKind;
  repository: GitHubRepositoryRef;
  actor: GitHubActorRef | undefined;
  number: number | undefined;
  title: string;
  url: string | undefined;
  externalId: string;
  deliveryId: string;
  now: string;
  labels: string[];
  analysis: Analysis;
}): WorkItem {
  const item: WorkItem = {
    id: input.externalId,
    kind: input.kind,
    status: "open",
    repository: input.repository,
    title: input.title,
    externalId: input.externalId,
    createdAt: input.now,
    updatedAt: input.now,
    analysis: input.analysis,
    labels: input.labels,
    sourceDeliveryIds: [input.deliveryId]
  };

  if (input.actor) item.actor = input.actor;
  if (input.number) item.number = input.number;
  if (input.url) item.url = input.url;

  return item;
}

function readRepository(payload: Record<string, unknown>): GitHubRepositoryRef | undefined {
  const repository = asRecord(payload.repository);
  const owner = asRecord(repository?.owner);
  const fullName = readString(repository?.full_name);

  if (!repository || !owner || !fullName) {
    return undefined;
  }

  const [ownerName, repoName] = fullName.split("/");
  const name = readString(repository.name) ?? repoName;

  if (!ownerName || !name) {
    return undefined;
  }

  const ref: GitHubRepositoryRef = {
    owner: readString(owner.login) ?? ownerName,
    name,
    fullName,
    private: Boolean(repository.private)
  };

  const id = readNumber(repository.id);
  const installationId = readNumber(asRecord(payload.installation)?.id);
  const defaultBranch = readString(repository.default_branch);
  if (id) ref.id = id;
  if (installationId) ref.installationId = installationId;
  if (defaultBranch) ref.defaultBranch = defaultBranch;

  return ref;
}

function readActor(value: unknown): GitHubActorRef | undefined {
  const actor = asRecord(value);
  const login = readString(actor?.login);
  if (!actor || !login) return undefined;

  const ref: GitHubActorRef = { login };
  const id = readNumber(actor.id);
  const type = readString(actor.type);
  if (id) ref.id = id;
  if (type) ref.type = type;
  return ref;
}

function readLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((label) => readString(asRecord(label)?.name)).filter((label): label is string => Boolean(label));
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readIdentifier(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function readSeverity(alert: Record<string, unknown>): "low" | "medium" | "high" | "critical" {
  const direct = normalizeSeverity(readString(alert.severity));
  if (direct) return direct;

  const rule = asRecord(alert.rule);
  const ruleSeverity = normalizeSeverity(readString(rule?.security_severity_level) ?? readString(rule?.severity));
  if (ruleSeverity) return ruleSeverity;

  const vulnerability = asRecord(alert.security_vulnerability);
  const vulnerabilitySeverity = normalizeSeverity(readString(vulnerability?.severity));
  return vulnerabilitySeverity ?? "high";
}

function normalizeSeverity(value: string | undefined): "low" | "medium" | "high" | "critical" | undefined {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
