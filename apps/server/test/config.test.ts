import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("falls back from invalid numeric environment values", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      PORT: "not-a-number",
      AI_MAX_INPUT_CHARS: "0",
      SCANNER_TIMEOUT_MS: "-10"
    });

    expect(config.port).toBe(3000);
    expect(config.ai.maxInputChars).toBe(12000);
    expect(config.scanners.timeoutMs).toBe(120000);
  });

  it("keeps explicit valid numeric environment values", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      PORT: "0",
      AI_MAX_INPUT_CHARS: "32",
      SCANNER_TIMEOUT_MS: "10"
    });

    expect(config.port).toBe(0);
    expect(config.ai.maxInputChars).toBe(32);
    expect(config.scanners.timeoutMs).toBe(10);
  });
});
