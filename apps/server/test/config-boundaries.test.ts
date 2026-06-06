import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig numeric boundaries", () => {
  it("keeps valid numeric settings including ephemeral test ports", () => {
    const config = loadConfig({
      PORT: "0",
      AI_MAX_INPUT_CHARS: "4096",
      SCANNER_TIMEOUT_MS: "5000"
    });

    expect(config.port).toBe(0);
    expect(config.ai.maxInputChars).toBe(4096);
    expect(config.scanners.timeoutMs).toBe(5000);
  });

  it("falls back when numeric settings are malformed or below safe limits", () => {
    const config = loadConfig({
      PORT: "3000abc",
      AI_MAX_INPUT_CHARS: "0",
      SCANNER_TIMEOUT_MS: "not-a-number"
    });

    expect(config.port).toBe(3000);
    expect(config.ai.maxInputChars).toBe(12000);
    expect(config.scanners.timeoutMs).toBe(120000);
  });
});
