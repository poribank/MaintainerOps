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

  it("rejects malformed repository full names", () => {
    const extraSegmentItems = normalizeGitHubWebhook({
      eventName: "issues",
      deliveryId: "delivery-malformed-repository",
      payload: {
        repository: {
          id: 1,
          full_name: "org/repo/extra",
          name: "repo",
          private: false,
          owner: { login: "org" }
        },
        issue: {
          number: 42,
          title: "Crash with token refresh",
          html_url: "https://github.com/org/repo/issues/42",
          labels: []
        },
        sender: { login: "reporter" }
      }
    });
    const blankSegmentItems = normalizeGitHubWebhook({
      eventName: "issues",
      deliveryId: "delivery-blank-repository-name",
      payload: {
        repository: {
          id: 1,
          full_name: "org/",
          name: "repo",
          private: false,
          owner: { login: "org" }
        },
        issue: {
          number: 42,
          title: "Crash with token refresh",
          html_url: "https://github.com/org/repo/issues/42",
          labels: []
        },
        sender: { login: "reporter" }
      }
    });

    expect(extraSegmentItems).toEqual([]);
    expect(blankSegmentItems).toEqual([]);
  });

  it("trims issue labels and ignores blank label names", () => {
    const items = normalizeGitHubWebhook({
      eventName: "issues",
      deliveryId: "delivery-trimmed-labels",
      payload: {
        repository: repositoryPayload(),
        issue: {
          number: 43,
          title: "Security report",
          html_url: "https://github.com/org/repo/issues/43",
          labels: [{ name: " security " }, { name: " " }, { name: "bug" }]
        },
        sender: { login: "reporter" }
      }
    });

    expect(items[0]?.labels).toEqual(["security", "bug"]);
  });

  it("marks closed issue events as resolved", () => {
    const items = normalizeGitHubWebhook({
      eventName: "issues",
      deliveryId: "delivery-closed-issue",
      payload: {
        action: "closed",
        repository: repositoryPayload(),
        issue: {
          number: 42,
          state: "closed",
          title: "Crash with token refresh",
          html_url: "https://github.com/org/repo/issues/42",
          labels: []
        },
        sender: { login: "maintainer" }
      }
    });

    expect(items[0]).toMatchObject({
      id: "issue:org/repo:42",
      status: "resolved"
    });
  });

  it("normalizes pull request events with stable review recommendations", () => {
    const items = normalizeGitHubWebhook({
      eventName: "pull_request",
      deliveryId: "delivery-pr",
      payload: {
        repository: repositoryPayload(),
        number: 7,
        pull_request: {
          number: 7,
          title: "Update release workflow",
          html_url: "https://github.com/org/repo/pull/7",
          author_association: "FIRST_TIME_CONTRIBUTOR",
          labels: [{ name: "security" }]
        },
        sender: { id: 10, login: "contributor", type: "User" }
      }
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "pull_request:org/repo:7",
      kind: "pull_request",
      number: 7,
      labels: ["security"]
    });
    expect(items[0]?.analysis.recommendations.map((item) => item.action)).toContain("write_check");
  });

  it("marks closed pull request events as resolved", () => {
    const items = normalizeGitHubWebhook({
      eventName: "pull_request",
      deliveryId: "delivery-closed-pr",
      payload: {
        action: "closed",
        repository: repositoryPayload(),
        number: 7,
        pull_request: {
          number: 7,
          state: "closed",
          title: "Update release workflow",
          html_url: "https://github.com/org/repo/pull/7",
          labels: []
        },
        sender: { login: "maintainer" }
      }
    });

    expect(items[0]).toMatchObject({
      id: "pull_request:org/repo:7",
      status: "resolved"
    });
  });

  it("normalizes release events into release readiness work items", () => {
    const items = normalizeGitHubWebhook({
      eventName: "release",
      deliveryId: "delivery-release",
      payload: {
        repository: repositoryPayload(),
        release: {
          tag_name: "v1.2.3",
          name: "v1.2.3",
          html_url: "https://github.com/org/repo/releases/tag/v1.2.3"
        },
        sender: { login: "maintainer" }
      }
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "release:org/repo:v1.2.3",
      kind: "release",
      title: "v1.2.3"
    });
    expect(items[0]?.analysis.recommendations.map((item) => item.action)).toContain("review_required");
  });

  it("marks deleted release events as resolved", () => {
    const items = normalizeGitHubWebhook({
      eventName: "release",
      deliveryId: "delivery-deleted-release",
      payload: {
        action: "deleted",
        repository: repositoryPayload(),
        release: {
          tag_name: "v1.2.3",
          name: "v1.2.3",
          html_url: "https://github.com/org/repo/releases/tag/v1.2.3"
        },
        sender: { login: "maintainer" }
      }
    });

    expect(items[0]).toMatchObject({
      id: "release:org/repo:v1.2.3",
      status: "resolved"
    });
  });

  it("uses numeric security alert identifiers instead of delivery ids", () => {
    const first = normalizeGitHubWebhook({
      eventName: "secret_scanning_alert",
      deliveryId: "delivery-security-1",
      payload: {
        repository: repositoryPayload(),
        alert: {
          number: 77,
          title: "Secret scanning alert",
          severity: "critical",
          html_url: "https://github.com/org/repo/security/secret-scanning/77"
        },
        sender: { login: "github-security", type: "Bot" }
      }
    });
    const redelivery = normalizeGitHubWebhook({
      eventName: "secret_scanning_alert",
      deliveryId: "delivery-security-2",
      payload: {
        repository: repositoryPayload(),
        alert: {
          number: 77,
          title: "Secret scanning alert",
          severity: "critical"
        },
        sender: { login: "github-security", type: "Bot" }
      }
    });

    expect(first[0]?.id).toBe("security:org/repo:secret_scanning_alert:77");
    expect(redelivery[0]?.id).toBe(first[0]?.id);
    expect(first[0]?.analysis.findings[0]?.severity).toBe("critical");
  });

  it("reads nested security severity from code scanning alerts", () => {
    const items = normalizeGitHubWebhook({
      eventName: "code_scanning_alert",
      deliveryId: "delivery-code-scanning",
      payload: {
        repository: repositoryPayload(),
        alert: {
          number: 12,
          rule: {
            description: "Hardcoded credential",
            security_severity_level: "high"
          }
        },
        sender: { login: "github-security", type: "Bot" }
      }
    });

    expect(items[0]?.id).toBe("security:org/repo:code_scanning_alert:12");
    expect(items[0]?.title).toBe("Hardcoded credential");
    expect(items[0]?.analysis.findings[0]?.severity).toBe("high");
  });

  it("preserves nested dependabot alert severity", () => {
    const items = normalizeGitHubWebhook({
      eventName: "dependabot_alert",
      deliveryId: "delivery-dependabot",
      payload: {
        repository: repositoryPayload(),
        alert: {
          number: 13,
          security_vulnerability: {
            severity: "medium"
          }
        },
        sender: { login: "github-security", type: "Bot" }
      }
    });

    expect(items[0]?.id).toBe("security:org/repo:dependabot_alert:13");
    expect(items[0]?.analysis.findings[0]?.severity).toBe("medium");
  });

  it("reads repository advisory payload fields for stable security work items", () => {
    const items = normalizeGitHubWebhook({
      eventName: "repository_advisory",
      deliveryId: "delivery-repository-advisory",
      payload: {
        repository: repositoryPayload(),
        repository_advisory: {
          ghsa_id: "GHSA-abcd-1234-9876",
          summary: "MaintainerOps demo advisory",
          severity: "critical",
          html_url: "https://github.com/org/repo/security/advisories/GHSA-abcd-1234-9876"
        },
        sender: { login: "maintainer", type: "User" }
      }
    });

    expect(items[0]).toMatchObject({
      id: "security:org/repo:repository_advisory:GHSA-abcd-1234-9876",
      title: "MaintainerOps demo advisory",
      url: "https://github.com/org/repo/security/advisories/GHSA-abcd-1234-9876"
    });
    expect(items[0]?.analysis.findings[0]?.severity).toBe("critical");
  });

  it("uses secret scanning secret type as a title fallback", () => {
    const items = normalizeGitHubWebhook({
      eventName: "secret_scanning_alert",
      deliveryId: "delivery-secret-scanning-title",
      payload: {
        repository: repositoryPayload(),
        alert: {
          number: 21,
          secret_type_display_name: "GitHub personal access token"
        },
        sender: { login: "github-security", type: "Bot" }
      }
    });

    expect(items[0]).toMatchObject({
      id: "security:org/repo:secret_scanning_alert:21",
      title: "Secret scanning alert: GitHub personal access token"
    });
  });
});

function repositoryPayload() {
  return {
    id: 1,
    full_name: "org/repo",
    name: "repo",
    private: false,
    owner: { login: "org" }
  };
}
