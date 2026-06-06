import { describe, expect, it } from "vitest";
import { calculateReleaseReadiness, evaluateSecurityPosture } from "../src/index.js";

describe("release readiness", () => {
  it("blocks releases with unresolved advisories and missing provenance", () => {
    const readiness = calculateReleaseReadiness({
      tagName: "v1.2.3",
      unresolvedAdvisories: 1,
      hasProvenance: false
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.map((finding) => finding.id)).toEqual(
      expect.arrayContaining(["release:unresolved-advisory", "release:missing-provenance"])
    );
  });

  it("ignores blank release check and breaking change evidence", () => {
    const readiness = calculateReleaseReadiness({
      tagName: "v1.2.3",
      failedRequiredChecks: ["", "  "],
      breakingChangeCandidates: ["", "docs only  "],
      hasProvenance: true
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.blockers.map((finding) => finding.id)).not.toContain("release:failed-required-checks");
    expect(readiness.warnings).toEqual([
      expect.objectContaining({
        id: "release:breaking-change-candidates",
        evidence: "docs only"
      })
    ]);
  });

  it("keeps non-blocking warnings reviewable", () => {
    const readiness = calculateReleaseReadiness({
      tagName: "v1.2.3",
      hasProvenance: true,
      missingChangelog: true
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.warnings.map((finding) => finding.id)).toContain("release:missing-changelog");
    expect(readiness.recommendations[0]).toMatchObject({
      id: "release:review-warnings",
      action: "review_required"
    });
  });
});

describe("security posture", () => {
  it("reports missing policy metadata and branch protection", () => {
    const posture = evaluateSecurityPosture({
      files: ["README.md", "package.json"],
      securityInsightsPresent: false,
      rulesetsEnabled: false,
      branchProtectionEnabled: false
    });

    expect(posture.findings.map((finding) => finding.id)).toEqual(
      expect.arrayContaining([
        "policy:security-md-missing",
        "policy:codeowners-missing",
        "policy:security-insights-missing",
        "policy:branch-protection-missing"
      ])
    );
  });
});
