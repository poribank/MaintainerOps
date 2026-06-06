import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { canSendContentToAi, parsePolicy } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("repository MaintainerOps policy", () => {
  it("keeps the checked-in policy safe for public pilots", async () => {
    const source = await readFile(path.join(repoRoot, ".github/maintainerops.yml"), "utf8");
    const policy = parsePolicy(source);

    expect(policy.automation).toEqual({
      applyLabels: false,
      writePrComments: false,
      createReleaseDrafts: false
    });
    expect(canSendContentToAi(policy)).toBe(false);
    expect(policy.dataRetention.rawContent).toBe(false);
    expect(policy.labels.allowed).toEqual(
      expect.arrayContaining(["bug", "enhancement", "documentation", "needs-reproduction", "security"])
    );
    expect(policy.policy.requireSecurityMd).toBe(true);
    expect(policy.policy.requireCodeowners).toBe(true);
    expect(policy.release.requireProvenance).toBe(true);
    expect(policy.release.blockOnUnresolvedAdvisory).toBe(true);
  });
});
