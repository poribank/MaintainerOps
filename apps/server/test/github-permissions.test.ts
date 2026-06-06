import { describe, expect, it } from "vitest";
import { MINIMUM_GITHUB_APP_PERMISSIONS } from "../src/services/github.js";

describe("GitHub App permissions", () => {
  it("includes Contents write for release draft write actions", () => {
    expect(MINIMUM_GITHUB_APP_PERMISSIONS).toMatchObject({
      metadata: "read",
      contents: "write",
      issues: "write",
      pull_requests: "write",
      checks: "write"
    });
  });
});
