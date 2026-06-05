import { describe, expect, it } from "vitest";
import { parseJsonBody, readRawBody } from "../src/services/body.js";

describe("request body helpers", () => {
  it("parses string JSON objects and preserves object bodies", () => {
    expect(parseJsonBody('{"action":"triage"}')).toEqual({ action: "triage" });
    expect(parseJsonBody({ action: "resolve" })).toEqual({ action: "resolve" });
  });

  it("parses buffered JSON bodies", () => {
    expect(parseJsonBody(Buffer.from('{"action":"triage"}'))).toEqual({ action: "triage" });
  });

  it("rejects malformed or non-object JSON bodies", () => {
    expect(() => parseJsonBody("{")).toThrow("valid JSON");
    expect(() => parseJsonBody("[]")).toThrow("JSON object");
    expect(() => parseJsonBody(null)).toThrow("JSON object");
  });

  it("returns the raw string body used for webhook signature verification", () => {
    expect(readRawBody('{"zen":"Keep it logically awesome."}')).toBe('{"zen":"Keep it logically awesome."}');
    expect(readRawBody(Buffer.from('{"zen":"Keep it logically awesome."}'))).toBe(
      '{"zen":"Keep it logically awesome."}'
    );
    expect(readRawBody({ zen: "Keep it logically awesome." })).toBe('{"zen":"Keep it logically awesome."}');
    expect(readRawBody(undefined)).toBe("{}");
  });
});
