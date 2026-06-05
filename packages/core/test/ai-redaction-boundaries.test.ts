import { describe, expect, it } from "vitest";
import { assertAiContentAllowed, parsePolicy, redactSensitiveText } from "../src/index.js";

describe("AI content safety boundaries", () => {
  it("redacts common provider and cloud token shapes before AI transfer", () => {
    const input = [
      "github=ghp_1234567890abcdef1234567890abcdef1234",
      "fineGrained=github_pat_1234567890abcdef1234567890abcdef1234",
      "aws=AKIA1234567890ABCDEF",
      "api_key: sk-1234567890abcdef",
      "token=secret-token-value-12345"
    ].join("\n");

    const redacted = redactSensitiveText(input);

    expect(redacted).not.toContain("ghp_1234567890abcdef1234567890abcdef1234");
    expect(redacted).not.toContain("github_pat_1234567890abcdef1234567890abcdef1234");
    expect(redacted).not.toContain("AKIA1234567890ABCDEF");
    expect(redacted).not.toContain("sk-1234567890abcdef");
    expect(redacted).not.toContain("secret-token-value-12345");
    expect(redacted.match(/\[REDACTED\]/g)).toHaveLength(5);
  });

  it("does not redact short ordinary words that appear near token labels", () => {
    expect(redactSensitiveText("token=short\napi_key: local")).toBe("token=short\napi_key: local");
  });

  it("requires explicit policy opt-in before AI content transfer", () => {
    expect(() => assertAiContentAllowed(parsePolicy("version: 1\n"))).toThrow("disabled by policy");

    expect(() =>
      assertAiContentAllowed(
        parsePolicy(`
version: 1
ai:
  enabled: true
  provider: openai
dataRetention:
  rawContent: true
  rawContentDays: 7
`)
      )
    ).not.toThrow();
  });
});
