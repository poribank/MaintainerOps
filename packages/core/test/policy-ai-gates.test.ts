import { describe, expect, it } from "vitest";
import { canPersistRawContent, canSendContentToAi, parsePolicy } from "../src/index.js";

describe("AI policy gates", () => {
  it("allows raw content persistence only when retention is enabled for positive days", () => {
    const disabledRetention = parsePolicy(`
version: 1
dataRetention:
  rawContent: true
  rawContentDays: 0
`);
    const disabledRawContent = parsePolicy(`
version: 1
dataRetention:
  rawContent: false
  rawContentDays: 7
`);
    const enabled = parsePolicy(`
version: 1
dataRetention:
  rawContent: true
  rawContentDays: 7
`);

    expect(canPersistRawContent(disabledRetention)).toBe(false);
    expect(canPersistRawContent(disabledRawContent)).toBe(false);
    expect(canPersistRawContent(enabled)).toBe(true);
  });

  it("allows AI content transfer only with enabled AI and raw-content retention", () => {
    const aiWithoutRetention = parsePolicy(`
version: 1
ai:
  enabled: true
  provider: openai
dataRetention:
  rawContent: false
  rawContentDays: 0
`);
    const retentionWithoutAi = parsePolicy(`
version: 1
ai:
  enabled: false
  provider: openai
dataRetention:
  rawContent: true
  rawContentDays: 7
`);
    const enabled = parsePolicy(`
version: 1
ai:
  enabled: true
  provider: openai
dataRetention:
  rawContent: true
  rawContentDays: 7
`);

    expect(canSendContentToAi(aiWithoutRetention)).toBe(false);
    expect(canSendContentToAi(retentionWithoutAi)).toBe(false);
    expect(canSendContentToAi(enabled)).toBe(true);
  });
});
