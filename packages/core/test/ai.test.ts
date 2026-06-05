import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "../src/index.js";

describe("redactSensitiveText", () => {
  it("redacts common token and key formats before AI transfer", () => {
    const redacted = redactSensitiveText([
      "github = ghp_abcdefghijklmnopqrstuvwxyz123456",
      "openai = sk-abcdefghijklmnopqrstuvwxyz123456",
      "aws = AKIAABCDEFGHIJKLMNOP",
      "token = \"abcdefghijklmnopqrstuvwxyz123456\"",
      "api_key: 'abcdefghijklmnopqrstuvwxyz123456'"
    ].join("\n"));

    expect(redacted).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz123456");
    expect(redacted).not.toContain("sk-abcdefghijklmnopqrstuvwxyz123456");
    expect(redacted).not.toContain("AKIAABCDEFGHIJKLMNOP");
    expect(redacted).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(redacted).toContain("token = \"[REDACTED]\"");
    expect(redacted).toContain("api_key: '[REDACTED]'");
  });
});
