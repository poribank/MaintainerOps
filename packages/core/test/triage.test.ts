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

  it("compares allowlisted and existing labels case-insensitively", () => {
    const policy = parsePolicy(`
version: 1
labels:
  allowed:
    - " Security "
`);

    const allowed = recommendIssueLabels({ title: "Security token leak" }, policy);
    expect(allowed.flatMap((item) => item.labels ?? [])).toContain("security");

    const existing = recommendIssueLabels({ title: "Security token leak", labels: ["Security"] }, policy);
    expect(existing.flatMap((item) => item.labels ?? [])).not.toContain("security");
  });
});
