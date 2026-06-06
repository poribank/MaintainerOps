import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canSendContentToAi, parsePolicy } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("public example policy", () => {
  it("parses the documented example with safe pilot defaults", async () => {
    const source = await readFile(path.join(repoRoot, "docs/maintainerops.example.yml"), "utf8");
    const policy = parsePolicy(source);

    expect(policy.automation).toEqual({
      applyLabels: false,
      writePrComments: false,
      createReleaseDrafts: false
    });
    expect(policy.ai).toEqual({ enabled: false, provider: "disabled" });
    expect(canSendContentToAi(policy)).toBe(false);
    expect(policy.dataRetention.rawContent).toBe(false);
    expect(policy.policy.minimumScorecardScore).toBe(7);
  });
});
