export type WorkItemKind = "pull_request" | "issue" | "release" | "security" | "policy";

export type WorkItemStatus = "open" | "triaged" | "snoozed" | "resolved";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type RecommendationAction =
  | "add_label"
  | "request_review"
  | "write_check"
  | "open_issue"
  | "block_release"
  | "review_required"
  | "no_action";

export interface GitHubRepositoryRef {
  id?: number;
  installationId?: number;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch?: string;
}

export interface GitHubActorRef {
  id?: number;
  login: string;
  type?: string;
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  source: "policy" | "triage" | "release" | "security" | "github" | "ai";
  description: string;
  evidence?: string;
}

export interface Recommendation {
  id: string;
  action: RecommendationAction;
  title: string;
  description: string;
  confidence: number;
  labels?: string[];
  requiresApproval: boolean;
}

export interface ScoreFactor {
  id: string;
  label: string;
  points: number;
  severity: Severity;
}

export interface RiskScore {
  value: number;
  priority: "low" | "normal" | "high" | "urgent";
  factors: ScoreFactor[];
}

export interface Analysis {
  summary: string;
  risk: RiskScore;
  findings: Finding[];
  recommendations: Recommendation[];
}

export interface WorkItem {
  id: string;
  kind: WorkItemKind;
  status: WorkItemStatus;
  repository: GitHubRepositoryRef;
  title: string;
  url?: string;
  number?: number;
  externalId: string;
  actor?: GitHubActorRef;
  createdAt: string;
  updatedAt: string;
  analysis: Analysis;
  labels: string[];
  sourceDeliveryIds: string[];
}

export interface MaintainerOpsPolicy {
  version: 1;
  automation: {
    applyLabels: boolean;
    writePrComments: boolean;
    createReleaseDrafts: boolean;
  };
  ai: {
    enabled: boolean;
    provider: "disabled" | "openai" | "anthropic" | "local";
  };
  dataRetention: {
    rawContent: boolean;
    rawContentDays: number;
    analysisDays: number;
    auditLogDays: number;
  };
  labels: {
    allowed: string[];
  };
  policy: {
    requireSecurityMd: boolean;
    requireCodeowners: boolean;
    requireScorecard: boolean;
    minimumScorecardScore: number;
  };
  release: {
    requireProvenance: boolean;
    blockOnUnresolvedAdvisory: boolean;
  };
}

export interface AuditLogEntry {
  id: string;
  occurredAt: string;
  actor: string;
  action: string;
  repository: string;
  workItemId?: string;
  deliveryId?: string;
  dryRun: boolean;
  githubRequestId?: string;
  outcome: "approved" | "rejected" | "applied" | "failed" | "recorded";
  metadata: Record<string, unknown>;
}

export interface PolicyValidationResult {
  valid: boolean;
  policy?: MaintainerOpsPolicy;
  errors: string[];
}
