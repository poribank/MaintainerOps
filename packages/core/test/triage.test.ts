import { describe, expect, it } from "vitest";
import { parsePolicy, recommendIssueLabels } from "../src/index.js";

describe("recommendIssueLabels", () => {
  it("recommends bug and reproduction labels within the allowlist", () => {
    const recommendations = recommendIssueLabels({
      title: "Crash when config is loaded",
      body: "The process throws an exception."
    });

    expect(recommendations.flatMap((item) => item.labels ?? [])).toEqual(
      expect.arrayContaining(["bug", "needs-reproduction"])
    );
  });

  it("does not recommend labels outside the repository allowlist", () => {
    const policy = parsePolicy(`
version: 1
labels:
  allowed:
    - documentation
`);
    const recommendations = recommendIssueLabels({ title: "Security token leak" }, policy);

    expect(recommendations.flatMap((item) => item.labels ?? [])).not.toContain("security");
  });

  it("does not duplicate existing labels with different casing", () => {
    const recommendations = recommendIssueLabels({
      title: "Crash when config is loaded",
      body: "Throws an exception on startup",
      labels: ["Bug", "Needs-Reproduction"]
    });

    expect(recommendations.map((item) => item.id)).not.toContain("label:bug");
    expect(recommendations.map((item) => item.id)).not.toContain("label:needs-reproduction");
  });
});
