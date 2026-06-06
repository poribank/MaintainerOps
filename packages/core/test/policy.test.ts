import { describe, expect, it } from "vitest";
import { canSendContentToAi, parsePolicy, validatePolicy } from "../src/index.js";

describe("policy", () => {
  it("merges defaults with repository policy", () => {
    const policy = parsePolicy(`
version: 1
automation:
  applyLabels: true
labels:
  allowed:
    - bug
`);

    expect(policy.automation.applyLabels).toBe(true);
    expect(policy.automation.writePrComments).toBe(false);
    expect(policy.labels.allowed).toEqual(["bug"]);
  });

  it("keeps AI disabled when provider is disabled", () => {
    const policy = parsePolicy(`
version: 1
ai:
  enabled: true
  provider: disabled
dataRetention:
  rawContent: true
  rawContentDays: 7
`);

    expect(policy.ai.enabled).toBe(false);
    expect(canSendContentToAi(policy)).toBe(false);
  });

  it("rejects invalid retention windows", () => {
    const result = validatePolicy(`
version: 1
dataRetention:
  rawContentDays: 999
`);

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("rawContentDays");
  });

  it("rejects unknown nested policy keys", () => {
    const result = validatePolicy(`
version: 1
automation:
  applylabels: true
policy:
  requireSecurityMD: true
`);

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("automation");
    expect(result.errors.join(" ")).toContain("policy");
  });
});
