import { describe, expect, it } from "vitest";
import { DEFAULT_POLICY, parsePolicy, validatePolicy } from "../src/index.js";

describe("policy boundary behavior", () => {
  it("returns independent label allow-lists for parsed policies", () => {
    const first = parsePolicy("version: 1\n");
    first.labels.allowed.push("mutated");

    const second = parsePolicy("version: 1\n");

    expect(second.labels.allowed).toEqual(DEFAULT_POLICY.labels.allowed);
    expect(second.labels.allowed).not.toContain("mutated");
  });

  it("rejects unknown top-level policy keys", () => {
    const result = validatePolicy(`
version: 1
unexpected: true
`);

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("Unrecognized key");
  });

  it("rejects unknown nested policy keys", () => {
    const result = validatePolicy(`
version: 1
automation:
  applyLabels: false
  autoMerge: true
`);

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toContain("automation");
  });
});
