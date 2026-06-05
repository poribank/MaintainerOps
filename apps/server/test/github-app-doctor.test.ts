import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("github app doctor script", () => {
  it("prints help without requiring GitHub App credentials", async () => {
    const { stdout } = await execFileAsync(process.execPath, [path.join(root, "scripts/github-app-doctor.mjs"), "--help"], {
      cwd: root,
      env: {}
    });

    expect(stdout).toContain("Usage: npm run github:doctor");
    expect(stdout).toContain("--require-release-drafts");
    expect(stdout).toContain("--require-administration");
  });
});
