import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeGitHubWebhook } from "@maintainerops/core";

const fixtureDir = path.resolve(process.cwd(), "fixtures/github");

describe("GitHub webhook fixtures", () => {
  it("normalizes every demo fixture into work items", async () => {
    const manifest = JSON.parse(await readFile(path.join(fixtureDir, "manifest.json"), "utf8")) as {
      fixtures: Array<{ event: string; path: string }>;
    };

    for (const fixture of manifest.fixtures) {
      const payload = JSON.parse(await readFile(path.join(fixtureDir, fixture.path), "utf8")) as Record<string, unknown>;
      const items = normalizeGitHubWebhook({
        eventName: fixture.event,
        deliveryId: `test-${fixture.path}`,
        payload
      });

      expect(items, fixture.path).toHaveLength(1);
      expect(items[0]?.repository.installationId, fixture.path).toBe(123456);
    }
  });
});
