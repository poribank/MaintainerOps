import { describe, expect, it } from "vitest";
import { evaluateSecurityPosture } from "../src/index.js";

describe("evaluateSecurityPosture", () => {
  it("does not report findings when required security controls are present", () => {
    const posture = evaluateSecurityPosture({
      files: ["README.md", "SECURITY.md", ".github/CODEOWNERS"],
      scorecardScore: 8.2,
      securityInsightsPresent: true,
      rulesetsEnabled: true,
      branchProtectionEnabled: false,
      unresolvedAdvisories: 0,
      secretScanningAlerts: 0,
      codeScanningAlerts: 0,
      dependabotAlerts: 0
    });

    expect(posture.findings).toEqual([]);
    expect(posture.recommendations).toEqual([]);
  });

  it("escalates critical security alerts to review-required recommendations", () => {
    const posture = evaluateSecurityPosture({
      files: ["SECURITY.md", "CODEOWNERS"],
      scorecardScore: 9,
      securityInsightsPresent: true,
      rulesetsEnabled: false,
      branchProtectionEnabled: true,
      unresolvedAdvisories: 1,
      secretScanningAlerts: 2,
      codeScanningAlerts: 3,
      dependabotAlerts: 4
    });

    expect(posture.findings.map((finding) => [finding.id, finding.severity, finding.source])).toEqual([
      ["security:unresolved-advisories", "critical", "security"],
      ["security:secret-scanning", "critical", "security"],
      ["security:code-scanning", "high", "security"],
      ["security:dependabot", "high", "security"]
    ]);
    expect(posture.recommendations.map((recommendation) => [recommendation.id, recommendation.action])).toEqual([
      ["recommend:security:unresolved-advisories", "review_required"],
      ["recommend:security:secret-scanning", "review_required"],
      ["recommend:security:code-scanning", "write_check"],
      ["recommend:security:dependabot", "write_check"]
    ]);
  });
});
