import { describe, expect, it } from "vitest";
import { assertAiContentAllowed, parsePolicy, redactSensitiveText } from "../src/index.js";

describe("AI content safety", () => {
  it("redacts common provider and cloud token shapes before AI transfer", () => {
    const input = [
      "github=ghp_1234567890abcdef1234567890abcdef1234",
      "fineGrained=github_pat_1234567890abcdef1234567890abcdef1234",
      "aws=AKIA1234567890ABCDEF",
      "openai=sk-abcdefghijklmnopqrstuvwxyz1234567890",
      "token=\"secret-token-value-12345\"",
      "api_key: 'abcdefghijklmnopqrstuvwxyz123456'"
    ].join("\n");

    const redacted = redactSensitiveText(input);

    expect(redacted).not.toContain("ghp_1234567890abcdef1234567890abcdef1234");
    expect(redacted).not.toContain("github_pat_1234567890abcdef1234567890abcdef1234");
    expect(redacted).not.toContain("AKIA1234567890ABCDEF");
    expect(redacted).not.toContain("sk-abcdefghijklmnopqrstuvwxyz1234567890");
    expect(redacted).not.toContain("secret-token-value-12345");
    expect(redacted).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(redacted).toContain("token=\"[REDACTED]\"");
    expect(redacted).toContain("api_key: '[REDACTED]'");
  });

  it("redacts private key blocks and preserves surrounding content", () => {
    const redacted = redactSensitiveText(`-----BEGIN PRIVATE KEY-----
abc123
-----END PRIVATE KEY-----
safe text`);

    expect(redacted).toBe("[REDACTED]\nsafe text");
  });

  it("does not redact short ordinary values near token labels", () => {
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
