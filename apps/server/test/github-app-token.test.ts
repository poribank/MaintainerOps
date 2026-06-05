import { describe, expect, it } from "vitest";
import {
  normalizePrivateKey,
  parseArgs,
  parseInstallationId,
  parseRepositoryName
} from "../../../scripts/github-app-token.mjs";

describe("github-app-token script helpers", () => {
  it("normalizes dashed CLI arguments", () => {
    expect(parseArgs(["--app-id", "123", "--installation-id", "456", "--json"])).toEqual({
      appId: "123",
      installationId: "456",
      json: "true"
    });
  });

  it("normalizes escaped private key newlines", () => {
    expect(normalizePrivateKey("-----BEGIN\\nKEY\\n-----END")).toBe("-----BEGIN\nKEY\n-----END");
  });

  it("requires installation ids to be positive integers", () => {
    expect(parseInstallationId("138105385")).toBe(138105385);
    expect(() => parseInstallationId("123abc")).toThrow("positive integer");
    expect(() => parseInstallationId("0")).toThrow("positive integer");
    expect(() => parseInstallationId("-1")).toThrow("positive integer");
  });

  it("requires repositories to use exact owner/name format", () => {
    expect(parseRepositoryName("poribank/MaintainerOps")).toBe("MaintainerOps");
    expect(() => parseRepositoryName("MaintainerOps")).toThrow("owner/name");
    expect(() => parseRepositoryName("poribank/MaintainerOps/extra")).toThrow("owner/name");
  });
});
