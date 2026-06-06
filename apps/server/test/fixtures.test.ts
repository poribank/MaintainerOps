import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeGitHubWebhook } from "@maintainerops/core";

const fixtureDir = path.resolve(process.cwd(), "fixtures/github");

describe("GitHub webhook fixtures", () => {
  it("keeps the demo fixture manifest internally consistent", async () => {
    const manifest = await readFixtureManifest();
    const paths = manifest.fixtures.map((fixture) => fixture.path);

    expect(new Set(paths).size).toBe(paths.length);

    for (const fixture of manifest.fixtures) {
      expect(fixture.description, fixture.path).toBeTruthy();
      expect(fixture.path, fixture.path).toMatch(new RegExp(`^${fixture.event}\\.`));

      const payload = JSON.parse(await readFile(path.join(fixtureDir, fixture.path), "utf8")) as Record<string, unknown>;
      expect(payload.action, fixture.path).toEqual(expect.any(String));
      expect(payload.repository, fixture.path).toEqual(expect.objectContaining({ full_name: expect.any(String) }));
      expect(payload.installation, fixture.path).toEqual(expect.objectContaining({ id: expect.any(Number) }));
    }
  });

  it("normalizes every demo fixture into work items", async () => {
    const manifest = await readFixtureManifest();

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

async function readFixtureManifest(): Promise<{
  fixtures: Array<{ event: string; path: string; description: string }>;
}> {
  return JSON.parse(await readFile(path.join(fixtureDir, "manifest.json"), "utf8")) as {
    fixtures: Array<{ event: string; path: string; description: string }>;
  };
}
