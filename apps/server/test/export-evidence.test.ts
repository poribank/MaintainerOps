import { execFile } from "node:child_process";
import type { AddressInfo } from "node:net";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { InMemoryMaintainerStore } from "../src/services/store.js";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("evidence export script", () => {
  it("exports live API evidence with the GitHub App permission profile", async () => {
    const outputDir = path.join(root, "tmp", `evidence-export-test-${process.pid}`);
    const { app } = await createApp({
      config: loadConfig({
        NODE_ENV: "test",
        HOST: "127.0.0.1",
        PORT: "0",
        WEB_ORIGIN: "http://localhost:5173",
        GITHUB_WEBHOOK_SECRET: "test-secret",
        SEED_DEMO_DATA: "true"
      }),
      store: new InMemoryMaintainerStore()
    });

    await app.listen({ host: "127.0.0.1", port: 0 });

    try {
      const address = app.server.address() as AddressInfo;
      const { stdout } = await execFileAsync(
        process.execPath,
        [
          path.join(root, "scripts/export-evidence.mjs"),
          "--url",
          `http://127.0.0.1:${address.port}/`,
          "--out",
          path.relative(root, outputDir)
        ],
        { cwd: root, timeout: 15000 }
      );
      const result = JSON.parse(stdout) as { jsonPath: string; markdownPath: string };
      const exported = JSON.parse(await readFile(result.jsonPath, "utf8")) as {
        baseUrl: string;
        githubAppPermissions: { minimum: Record<string, string>; optional: Record<string, string> };
      };
      const markdown = await readFile(result.markdownPath, "utf8");

      expect(exported.baseUrl).not.toMatch(/\/$/);
      expect(exported.githubAppPermissions.minimum).toMatchObject({
        metadata: "read",
        contents: "read",
        checks: "write"
      });
      expect(exported.githubAppPermissions.optional.contents).toContain("release drafts");
      expect(markdown).toContain("## GitHub App Permissions");
      expect(markdown).toContain("- contents: read");
    } finally {
      await app.close();
      await rm(outputDir, { force: true, recursive: true });
    }
  });
});
