import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { createGitHubWriteClient, OctokitGitHubWriteClient } from "../src/services/github.js";

describe("GitHub write client validation", () => {
  it("does not create a write client when writes are disabled", () => {
    const config = loadConfig({
      GITHUB_WRITES_ENABLED: "false",
      GITHUB_APP_ID: "123",
      GITHUB_PRIVATE_KEY: "not-a-private-key"
    });

    expect(createGitHubWriteClient(config)).toBeUndefined();
  });

  it("rejects partially numeric GitHub App ids before private-key use", () => {
    const config = loadConfig({
      GITHUB_WRITES_ENABLED: "true",
      GITHUB_APP_ID: "123abc",
      GITHUB_PRIVATE_KEY: "not-a-private-key"
    });

    expect(() => new OctokitGitHubWriteClient(config)).toThrow("GitHub App id must be a positive integer.");
  });

  it("rejects zero GitHub App ids before private-key use", () => {
    const config = loadConfig({
      GITHUB_WRITES_ENABLED: "true",
      GITHUB_APP_ID: "0",
      GITHUB_PRIVATE_KEY: "not-a-private-key"
    });

    expect(() => new OctokitGitHubWriteClient(config)).toThrow("GitHub App id must be a positive integer.");
  });

  it("constructs with a positive integer App id without contacting GitHub", () => {
    const config = loadConfig({
      GITHUB_WRITES_ENABLED: "true",
      GITHUB_APP_ID: "123",
      GITHUB_PRIVATE_KEY: "not-a-private-key"
    });

    expect(() => new OctokitGitHubWriteClient(config)).not.toThrow();
  });
});
