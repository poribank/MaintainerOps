import { describe, expect, it } from "vitest";
import { findUnownedFiles, parseCodeowners } from "../src/index.js";

describe("CODEOWNERS", () => {
  it("parses entries, inline comments, and ownerless overrides", () => {
    const parsed = parseCodeowners(`
*.ts @maintainers/typescript # inline owner comment
docs/
!secret @maintainers/security
src/* not-a-valid-owner
`);

    expect(parsed.entries).toEqual([
      { pattern: "*.ts", owners: ["@maintainers/typescript"], line: 2 },
      { pattern: "docs/", owners: [], line: 3 }
    ]);
    expect(parsed.errors.map((error) => error.kind)).toEqual(
      expect.arrayContaining(["unsupported_negation", "invalid_owner"])
    );
  });

  it("finds files without owner routes", () => {
    const parsed = parseCodeowners(`
.github/workflows/* @maintainers/security
src/** @maintainers/core
`);

    expect(findUnownedFiles(["src/index.ts", ".github/workflows/release.yml", "README.md"], parsed.entries)).toEqual([
      "README.md"
    ]);
  });

  it("matches common GitHub CODEOWNERS glob examples", () => {
    const parsed = parseCodeowners(`
* @global-owner
*.js @js-owner
docs/* @docs-owner
apps/ @apps-owner
/build/logs/ @build-owner
**/logs @logs-owner
/apps/github
`);

    expect(findUnownedFiles(["src/index.js"], parsed.entries)).toEqual([]);
    expect(findUnownedFiles(["docs/getting-started.md"], parsed.entries)).toEqual([]);
    expect(findUnownedFiles(["docs/build-app/troubleshooting.md"], parsed.entries)).toEqual([]);
    expect(findUnownedFiles(["services/apps/api.ts"], parsed.entries)).toEqual([]);
    expect(findUnownedFiles(["build/logs/output.txt"], parsed.entries)).toEqual([]);
    expect(findUnownedFiles(["scripts/logs/output.txt"], parsed.entries)).toEqual([]);
    expect(findUnownedFiles(["apps/github/index.ts"], parsed.entries)).toEqual(["apps/github/index.ts"]);
  });
});
