import type { RiskScore, ScoreFactor, Severity } from "./types.js";

export interface RiskScoreInput {
  kind: "pull_request" | "issue" | "release" | "security" | "policy";
  changedFiles?: string[];
  labels?: string[];
  staleDays?: number;
  newContributor?: boolean;
  ciFailed?: boolean;
  missingTests?: boolean;
  securitySensitive?: boolean;
  releaseImpact?: boolean;
  unresolvedAdvisory?: boolean;
  scorecardScore?: number;
  codeownersMissing?: boolean;
}

const SECURITY_PATH_PATTERNS = [
  /^\.github\/workflows\//,
  /^\.github\/dependabot\.yml$/,
  /^\.github\/CODEOWNERS$/,
  /^CODEOWNERS$/,
  /^SECURITY\.md$/i,
  /^package-lock\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^Cargo\.lock$/,
  /^go\.sum$/,
  /^Dockerfile$/,
  /^docker-compose\.ya?ml$/
];

export function scoreWorkItem(input: RiskScoreInput): RiskScore {
  const factors: ScoreFactor[] = [];

  addFactor(factors, input.kind === "security", "security-item", "Security signal", 35, "high");
  addFactor(factors, input.unresolvedAdvisory === true, "unresolved-advisory", "Unresolved advisory", 35, "critical");
  addFactor(factors, input.releaseImpact === true, "release-impact", "Release-impacting change", 18, "medium");
  addFactor(factors, input.ciFailed === true, "ci-failed", "Failing required checks", 16, "medium");
  addFactor(factors, input.missingTests === true, "missing-tests", "Tests not detected", 12, "medium");
  addFactor(factors, input.newContributor === true, "new-contributor", "New contributor", 8, "low");
  addFactor(factors, input.codeownersMissing === true, "codeowners-missing", "No CODEOWNERS route", 14, "medium");
  addFactor(
    factors,
    typeof input.scorecardScore === "number" && input.scorecardScore < 7,
    "scorecard-low",
    "OpenSSF Scorecard below threshold",
    18,
    "medium"
  );

  const changedFiles = input.changedFiles ?? [];
  const sensitiveFiles = changedFiles.filter(isSecuritySensitivePath);
  addFactor(
    factors,
    input.securitySensitive === true || sensitiveFiles.length > 0,
    "security-sensitive-files",
    "Security-sensitive files changed",
    Math.min(24, 8 + sensitiveFiles.length * 4),
    "high"
  );

  const staleDays = input.staleDays ?? 0;
  addFactor(factors, staleDays >= 14, "stale", "Waiting for maintainer attention", Math.min(20, staleDays), "low");

  const value = Math.min(100, factors.reduce((sum, factor) => sum + factor.points, 0));
  return {
    value,
    priority: priorityForScore(value),
    factors
  };
}

export function isSecuritySensitivePath(path: string): boolean {
  return SECURITY_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

function addFactor(
  factors: ScoreFactor[],
  condition: boolean,
  id: string,
  label: string,
  points: number,
  severity: Severity
): void {
  if (condition) {
    factors.push({ id, label, points, severity });
  }
}

function priorityForScore(score: number): RiskScore["priority"] {
  if (score >= 70) return "urgent";
  if (score >= 45) return "high";
  if (score >= 20) return "normal";
  return "low";
}
