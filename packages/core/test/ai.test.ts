import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "../src/index.js";

describe("redactSensitiveText", () => {
  it("redacts private key blocks before raw content can be sent to AI", () => {
    const redacted = redactSensitiveText(`-----BEGIN PRIVATE KEY-----
abc123
-----END PRIVATE KEY-----
safe text`);

    expect(redacted).toBe("[REDACTED]\nsafe text");
  });

  it("redacts OpenAI-style secret keys", () => {
    const redacted = redactSensitiveText("OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz1234567890");

    expect(redacted).toBe("OPENAI_API_KEY=[REDACTED]");
  });
});
