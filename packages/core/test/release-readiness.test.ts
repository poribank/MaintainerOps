import { describe, expect, it } from "vitest";
import { calculateReleaseReadiness, parsePolicy } from "../src/index.js";

describe("calculateReleaseReadiness", () => {
  it("keeps warning-only release findings from blocking publication", () => {
    const readiness = calculateReleaseReadiness({
      tagName: "v1.2.3",
      hasProvenance: true,
      unresolvedAdvisories: 0,
      missingChangelog: true,
      breakingChangeCandidates: ["feat(api): rename public option"],
      scorecardScore: 6.5
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.warnings.map((finding) => [finding.id, finding.severity, finding.evidence])).toEqual([
      ["release:missing-changelog", "medium", undefined],
      ["release:breaking-change-candidates", "medium", "feat(api): rename public option"],
      ["release:scorecard-threshold", "medium", undefined]
    ]);
    expect(readiness.recommendations).toEqual([
      expect.objectContaining({
        id: "release:ready",
        action: "no_action",
        title: "Release gates passed"
      })
    ]);
  });

  it("respects policy when advisory and provenance blockers are disabled", () => {
    const policy = parsePolicy(`
version: 1
release:
  requireProvenance: false
  blockOnUnresolvedAdvisory: false
`);

    const readiness = calculateReleaseReadiness(
      {
        tagName: "v1.2.3",
        hasProvenance: false,
        unresolvedAdvisories: 2
      },
      policy
    );

    expect(readiness.ready).toBe(true);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.recommendations[0]?.action).toBe("no_action");
  });
});
