import { describe, expect, it } from "vitest";
import { calculateReleaseReadiness } from "../src/index.js";

describe("release blockers", () => {
  it("records failed required checks as blocking evidence", () => {
    const readiness = calculateReleaseReadiness({
      tagName: "v2.0.0",
      hasProvenance: true,
      failedRequiredChecks: ["ci / check", "CodeQL"]
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toEqual([
      expect.objectContaining({
        id: "release:failed-required-checks",
        severity: "high",
        source: "release",
        evidence: "ci / check, CodeQL"
      })
    ]);
    expect(readiness.warnings).toEqual([]);
    expect(readiness.recommendations).toEqual([
      expect.objectContaining({
        id: "release:block",
        action: "block_release",
        title: "Hold release"
      })
    ]);
  });
});
