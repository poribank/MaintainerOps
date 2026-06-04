import { describe, expect, it } from "vitest";
import { createAuditLogEntry } from "../src/index.js";

describe("createAuditLogEntry", () => {
  it("creates unique audit identifiers for same-time repeated actions", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const first = createAuditLogEntry({
      actor: "maintainer",
      action: "triage",
      repository: "org/repo",
      now
    });
    const second = createAuditLogEntry({
      actor: "maintainer",
      action: "triage",
      repository: "org/repo",
      now
    });

    expect(first.id).not.toBe(second.id);
    expect(first.id).toContain("audit:2026-01-01T00:00:00.000Z:org/repo:triage");
  });
});
