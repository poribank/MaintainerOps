import type { Finding, MaintainerOpsPolicy, Recommendation } from "./types.js";
import { DEFAULT_POLICY } from "./policy.js";

export interface ReleaseReadinessInput {
  tagName: string;
  failedRequiredChecks?: string[];
  unresolvedAdvisories?: number;
  hasProvenance?: boolean;
  missingChangelog?: boolean;
  breakingChangeCandidates?: string[];
  scorecardScore?: number;
}

export interface ReleaseReadiness {
  ready: boolean;
  blockers: Finding[];
  warnings: Finding[];
  recommendations: Recommendation[];
}

export function calculateReleaseReadiness(
  input: ReleaseReadinessInput,
  policy: MaintainerOpsPolicy = DEFAULT_POLICY
): ReleaseReadiness {
  const blockers: Finding[] = [];
  const warnings: Finding[] = [];
  const failedRequiredChecks = nonEmptyStrings(input.failedRequiredChecks);
  const breakingChangeCandidates = nonEmptyStrings(input.breakingChangeCandidates);

  if (policy.release.blockOnUnresolvedAdvisory && (input.unresolvedAdvisories ?? 0) > 0) {
    blockers.push({
      id: "release:unresolved-advisory",
      title: "Unresolved security advisory",
      severity: "critical",
      source: "release",
      description: `${input.unresolvedAdvisories} unresolved advisories block this release.`
    });
  }

  if (failedRequiredChecks.length > 0) {
    const finding: Finding = {
      id: "release:failed-required-checks",
      title: "Required checks are failing",
      severity: "high",
      source: "release",
      description: "One or more required checks failed."
    };
    finding.evidence = failedRequiredChecks.join(", ");
    blockers.push(finding);
  }

  if (policy.release.requireProvenance && input.hasProvenance === false) {
    blockers.push({
      id: "release:missing-provenance",
      title: "Missing provenance",
      severity: "high",
      source: "release",
      description: "Release provenance or attestation was not found."
    });
  }

  if (input.missingChangelog === true) {
    warnings.push({
      id: "release:missing-changelog",
      title: "Missing changelog",
      severity: "medium",
      source: "release",
      description: "No changelog update was detected for this release."
    });
  }

  if (breakingChangeCandidates.length > 0) {
    const finding: Finding = {
      id: "release:breaking-change-candidates",
      title: "Breaking change candidates need review",
      severity: "medium",
      source: "release",
      description: "Merged changes look potentially breaking."
    };
    finding.evidence = breakingChangeCandidates.join(", ");
    warnings.push(finding);
  }

  if (typeof input.scorecardScore === "number" && input.scorecardScore < policy.policy.minimumScorecardScore) {
    warnings.push({
      id: "release:scorecard-threshold",
      title: "Scorecard below threshold",
      severity: "medium",
      source: "release",
      description: `Scorecard ${input.scorecardScore} is below configured threshold ${policy.policy.minimumScorecardScore}.`
    });
  }

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
    recommendations: [buildReleaseRecommendation(blockers, warnings)]
  };
}

function buildReleaseRecommendation(blockers: Finding[], warnings: Finding[]): Recommendation {
  if (blockers.length > 0) {
    return {
      id: "release:block",
      action: "block_release",
      title: "Hold release",
      description: "Resolve blocking findings before publishing this release.",
      confidence: 0.9,
      requiresApproval: false
    };
  }

  if (warnings.length > 0) {
    return {
      id: "release:review-warnings",
      action: "review_required",
      title: "Review release warnings",
      description: "No configured blockers were found, but release warnings need maintainer review.",
      confidence: 0.82,
      requiresApproval: false
    };
  }

  return {
    id: "release:ready",
    action: "no_action",
    title: "Release gates passed",
    description: "No configured release blockers or warnings were found.",
    confidence: 0.9,
    requiresApproval: false
  };
}

function nonEmptyStrings(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter((value) => value.length > 0);
}
