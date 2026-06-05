import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(process.cwd(), "../..");
const tokenScript = path.join(repoRoot, "scripts/github-app-token.mjs");

describe("github-app-token CLI validation", () => {
  it("fails before requesting a token when the app id is missing", async () => {
    const result = await runTokenCli({});

    expect(result.code).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("GITHUB_APP_ID or --app-id is required.");
  });

  it("fails before requesting a token when the installation id is invalid", async () => {
    const result = await runTokenCli({
      GITHUB_APP_ID: "123",
      GITHUB_PRIVATE_KEY: "test-key",
      GITHUB_INSTALLATION_ID: "not-a-number"
    });

    expect(result.code).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("GITHUB_INSTALLATION_ID or --installation-id is required.");
  });
});

async function runTokenCli(env: Record<string, string>) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [tokenScript], {
      cwd: repoRoot,
      env
    });
    return { code: 0, stdout, stderr };
  } catch (error) {
    const result = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: result.code ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? ""
    };
  }
}
