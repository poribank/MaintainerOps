import type { Finding, MaintainerOpsPolicy, Recommendation } from "./types.js";
import { DEFAULT_POLICY } from "./policy.js";

export interface SecurityPostureInput {
  files: string[];
  scorecardScore?: number;
  codeownersErrors?: number;
  rulesetsEnabled?: boolean;
  branchProtectionEnabled?: boolean;
  securityInsightsPresent?: boolean;
  unresolvedAdvisories?: number;
  secretScanningAlerts?: number;
  codeScanningAlerts?: number;
  dependabotAlerts?: number;
}

export interface SecurityPosture {
  findings: Finding[];
  recommendations: Recommendation[];
}

export function evaluateSecurityPosture(
  input: SecurityPostureInput,
  policy: MaintainerOpsPolicy = DEFAULT_POLICY
): SecurityPosture {
  const files = new Set(input.files);
  const findings: Finding[] = [];

  if (policy.policy.requireSecurityMd && !hasFile(files, "SECURITY.md")) {
    findings.push({
      id: "policy:security-md-missing",
      title: "SECURITY.md missing",
      severity: "medium",
      source: "policy",
      description: "The repository does not publish a security reporting policy."
    });
  }

  if (policy.policy.requireCodeowners && !hasAnyFile(files, ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"])) {
    findings.push({
      id: "policy:codeowners-missing",
      title: "CODEOWNERS missing",
      severity: "medium",
      source: "policy",
      description: "The repository has no CODEOWNERS file for review routing."
    });
  }

  if ((input.codeownersErrors ?? 0) > 0) {
    findings.push({
      id: "policy:codeowners-errors",
      title: "CODEOWNERS contains errors",
      severity: "medium",
      source: "policy",
      description: `${input.codeownersErrors} CODEOWNERS parsing errors were detected.`
    });
  }

  if (!input.securityInsightsPresent) {
    findings.push({
      id: "policy:security-insights-missing",
      title: "Security Insights missing",
      severity: "low",
      source: "policy",
      description: "No OpenSSF Security Insights metadata was detected."
    });
  }

  if (policy.policy.requireScorecard && typeof input.scorecardScore !== "number") {
    findings.push({
      id: "policy:scorecard-missing",
      title: "Scorecard result missing",
      severity: "medium",
      source: "policy",
      description: "OpenSSF Scorecard has not reported a result."
    });
  }

  if (typeof input.scorecardScore === "number" && input.scorecardScore < policy.policy.minimumScorecardScore) {
    findings.push({
      id: "policy:scorecard-low",
      title: "Scorecard below threshold",
      severity: "medium",
      source: "policy",
      description: `OpenSSF Scorecard is ${input.scorecardScore}, below threshold ${policy.policy.minimumScorecardScore}.`
    });
  }

  if (!input.rulesetsEnabled && !input.branchProtectionEnabled) {
    findings.push({
      id: "policy:branch-protection-missing",
      title: "No ruleset or branch protection detected",
      severity: "high",
      source: "policy",
      description: "The repository does not appear to enforce protected branch or ruleset requirements."
    });
  }

  addAlertFinding(findings, "security:unresolved-advisories", "Unresolved advisories", input.unresolvedAdvisories, "critical");
  addAlertFinding(findings, "security:secret-scanning", "Secret scanning alerts", input.secretScanningAlerts, "critical");
  addAlertFinding(findings, "security:code-scanning", "Code scanning alerts", input.codeScanningAlerts, "high");
  addAlertFinding(findings, "security:dependabot", "Dependabot alerts", input.dependabotAlerts, "high");

  return {
    findings,
    recommendations: findings.map((finding) => ({
      id: `recommend:${finding.id}`,
      action: finding.severity === "critical" ? "review_required" : "write_check",
      title: `Review ${finding.title}`,
      description: finding.description,
      confidence: 0.85,
      requiresApproval: false
    }))
  };
}

function hasFile(files: Set<string>, path: string): boolean {
  return files.has(path) || files.has(path.toLowerCase());
}

function hasAnyFile(files: Set<string>, paths: string[]): boolean {
  return paths.some((path) => hasFile(files, path));
}

function addAlertFinding(
  findings: Finding[],
  id: string,
  title: string,
  count: number | undefined,
  severity: "high" | "critical"
): void {
  if ((count ?? 0) > 0) {
    findings.push({
      id,
      title,
      severity,
      source: "security",
      description: `${count} active alerts need maintainer review.`
    });
  }
}
