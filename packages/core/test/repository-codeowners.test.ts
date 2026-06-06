import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findUnownedFiles, parseCodeowners } from "../src/index.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("repository CODEOWNERS", () => {
  it("parses the checked-in CODEOWNERS file without routing errors", async () => {
    const source = await readFile(path.join(repoRoot, ".github/CODEOWNERS"), "utf8");
    const parsed = parseCodeowners(source);

    expect(parsed.errors).toEqual([]);
    expect(parsed.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pattern: "*",
          owners: ["@poribank"]
        })
      ])
    );
  });

  it("covers core pilot surfaces with code-owner review", async () => {
    const source = await readFile(path.join(repoRoot, ".github/CODEOWNERS"), "utf8");
    const parsed = parseCodeowners(source);

    expect(
      findUnownedFiles(
        [
          "README.md",
          ".github/workflows/ci.yml",
          "apps/server/src/app.ts",
          "apps/web/src/App.tsx",
          "packages/core/src/policy.ts",
          "docs/GITHUB_APP_SETUP.md"
        ],
        parsed.entries
      )
    ).toEqual([]);
  });
});
