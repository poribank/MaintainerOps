import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGitHubSignature } from "../src/services/signature.js";

describe("verifyGitHubSignature", () => {
  it("accepts a valid sha256 HMAC signature", () => {
    const body = '{"action":"opened"}';
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;

    expect(verifyGitHubSignature(body, signature, "secret")).toBe(true);
  });

  it("rejects missing, malformed, wrong-secret, and wrong-length signatures", () => {
    const body = '{"action":"opened"}';
    const signature = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
    const emptySecretSignature = `sha256=${createHmac("sha256", "").update(body).digest("hex")}`;

    expect(verifyGitHubSignature(body, undefined, "secret")).toBe(false);
    expect(verifyGitHubSignature(body, signature.replace("sha256=", "sha1="), "secret")).toBe(false);
    expect(verifyGitHubSignature(body, signature, "other-secret")).toBe(false);
    expect(verifyGitHubSignature(body, "sha256=bad", "secret")).toBe(false);
    expect(verifyGitHubSignature(body, emptySecretSignature, "")).toBe(false);
  });
});
