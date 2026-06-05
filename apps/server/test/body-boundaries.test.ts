import { describe, expect, it } from "vitest";
import { parseJsonBody, readRawBody } from "../src/services/body.js";

describe("request body boundary handling", () => {
  it("accepts JSON object strings with surrounding whitespace", () => {
    expect(parseJsonBody(' \n { "action": "triage", "dryRun": false } \t')).toEqual({
      action: "triage",
      dryRun: false
    });
  });

  it("rejects malformed JSON bodies before object validation", () => {
    expect(() => parseJsonBody("")).toThrow("valid JSON");
  });

  it.each([
    ["number", "123"],
    ["boolean", "true"],
    ["null", "null"],
    ["array", "[]"],
    ["string", '"triage"']
  ])("rejects %s JSON bodies", (_label, body) => {
    expect(() => parseJsonBody(body)).toThrow("JSON object");
  });

  it("serializes nullish raw bodies as an empty JSON object fallback", () => {
    expect(readRawBody(null)).toBe("{}");
    expect(readRawBody(undefined)).toBe("{}");
  });
});
