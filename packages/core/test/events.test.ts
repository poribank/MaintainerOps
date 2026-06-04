import { describe, expect, it } from "vitest";
import { normalizeGitHubWebhook } from "../src/index.js";

describe("normalizeGitHubWebhook", () => {
  it("normalizes issue events into work items with label recommendations", () => {
    const items = normalizeGitHubWebhook({
      eventName: "issues",
      deliveryId: "delivery-1",
      payload: {
        repository: {
          id: 1,
          full_name: "org/repo",
          name: "repo",
          private: false,
          owner: { login: "org" }
        },
        installation: { id: 99 },
        issue: {
          number: 42,
          title: "Crash with token refresh",
          body: "Throws exception on startup",
          html_url: "https://github.com/org/repo/issues/42",
          labels: []
        },
        sender: { login: "reporter" }
      }
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("issue");
    expect(items[0]?.repository.installationId).toBe(99);
    expect(items[0]?.analysis.recommendations.flatMap((item) => item.labels ?? [])).toContain("bug");
  });
});
