import { describe, expect, it } from "vitest";
import { findUnownedFiles, parseCodeowners } from "../src/index.js";

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
});
