import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  it("parses valid integer environment settings", () => {
    const config = loadConfig({
      PORT: "4000",
      AI_MAX_INPUT_CHARS: "8000",
      SCANNER_TIMEOUT_MS: "30000"
    });

    expect(config.port).toBe(4000);
    expect(config.ai.maxInputChars).toBe(8000);
    expect(config.scanners.timeoutMs).toBe(30000);
  });

  it("falls back when integer environment settings are malformed or out of range", () => {
    const malformed = loadConfig({
      PORT: "3000abc",
      AI_MAX_INPUT_CHARS: "not-a-number",
      SCANNER_TIMEOUT_MS: "1.5"
    });
    expect(malformed.port).toBe(3000);
    expect(malformed.ai.maxInputChars).toBe(12000);
    expect(malformed.scanners.timeoutMs).toBe(120000);

    const outOfRange = loadConfig({
      PORT: "70000",
      AI_MAX_INPUT_CHARS: "0",
      SCANNER_TIMEOUT_MS: "-1"
    });
    expect(outOfRange.port).toBe(3000);
    expect(outOfRange.ai.maxInputChars).toBe(12000);
    expect(outOfRange.scanners.timeoutMs).toBe(120000);
  });
});
