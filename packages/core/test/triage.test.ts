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

  it("recognizes credential disclosure reports as security-sensitive", () => {
    const recommendations = recommendIssueLabels({
      title: "Credential disclosure in debug logs",
      body: "The logs include an access token and private key material."
    });

    expect(recommendations.flatMap((item) => item.labels ?? [])).toContain("security");
  });

  it("recommends maintainer review for possible duplicates without adding labels", () => {
    const recommendations = recommendIssueLabels({
      title: "Crash looks like a duplicate",
      body: "This seems same as #42 and may already be reported."
    });

    expect(recommendations).toContainEqual(
      expect.objectContaining({
        id: "triage:duplicate-review",
        action: "review_required",
        requiresApproval: false
      })
    );
    const duplicateReview = recommendations.find((item) => item.id === "triage:duplicate-review");
    expect(duplicateReview?.labels).toBeUndefined();
  });
});
