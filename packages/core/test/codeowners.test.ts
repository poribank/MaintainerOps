import { describe, expect, it } from "vitest";
import { findUnownedFiles, matchesCodeownersPattern, parseCodeowners } from "../src/index.js";

describe("CODEOWNERS", () => {
  it("parses entries and reports invalid lines", () => {
    const parsed = parseCodeowners(`
*.ts @maintainers/typescript
docs/
!secret @maintainers/security
`);

    expect(parsed.entries).toHaveLength(3);
    expect(parsed.errors.map((error) => error.kind)).toEqual(
      expect.arrayContaining(["missing_owner", "unsupported_negation"])
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

  it("matches slashless patterns against file basenames in any directory", () => {
    const parsed = parseCodeowners(`
*.ts @maintainers/typescript
`);

    expect(matchesCodeownersPattern("*.ts", "src/index.ts")).toBe(true);
    expect(findUnownedFiles(["src/index.ts", "packages/core/src/index.ts", "README.md"], parsed.entries)).toEqual([
      "README.md"
    ]);
  });

  it("does not count ownerless or invalid owner entries as coverage", () => {
    const parsed = parseCodeowners(`
docs/
scripts/** not-an-owner
README.md @maintainers/docs
`);

    expect(findUnownedFiles(["docs/guide.md", "scripts/release.sh", "README.md"], parsed.entries)).toEqual([
      "docs/guide.md",
      "scripts/release.sh"
    ]);
  });
});
