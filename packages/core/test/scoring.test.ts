import { describe, expect, it } from "vitest";
import { isSecuritySensitivePath, scoreWorkItem } from "../src/index.js";

describe("scoreWorkItem", () => {
  it("prioritizes security-sensitive release workflow changes", () => {
    const score = scoreWorkItem({
      kind: "pull_request",
      changedFiles: [".github/workflows/release.yml", "package-lock.json"],
      newContributor: true,
      releaseImpact: true,
      missingTests: true
    });

    expect(score.value).toBeGreaterThanOrEqual(45);
    expect(score.priority).toBe("high");
    expect(score.factors.map((factor) => factor.id)).toContain("security-sensitive-files");
  });

  it("recognizes dependency and workflow paths", () => {
    expect(isSecuritySensitivePath("pnpm-lock.yaml")).toBe(true);
    expect(isSecuritySensitivePath("src/component.tsx")).toBe(false);
  });
});
