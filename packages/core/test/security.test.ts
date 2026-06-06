import { describe, expect, it } from "vitest";
import { evaluateSecurityPosture } from "../src/index.js";

describe("evaluateSecurityPosture", () => {
  it("recognizes security policy files in common GitHub locations", () => {
    for (const securityFile of ["SECURITY.md", ".github/security.md", "/docs/SECURITY.md"]) {
      const posture = evaluateSecurityPosture({
        files: [securityFile, ".github/CODEOWNERS"],
        scorecardScore: 8,
        securityInsightsPresent: true,
        branchProtectionEnabled: true,
        rulesetsEnabled: false
      });

      expect(posture.findings.map((finding) => finding.id)).not.toContain("policy:security-md-missing");
    }
  });
});
