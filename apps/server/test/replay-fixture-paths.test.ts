import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(process.cwd(), "../..");
const replayScript = path.join(repoRoot, "scripts/replay-webhook-fixtures.mjs");

describe("webhook fixture replay path handling", () => {
  it("rejects relative fixture paths outside the bundled fixture directory", async () => {
    const result = await runReplay("--fixture", "../../../../.env.example");

    expect(result.code).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Fixture path must stay inside apps/server/fixtures/github");
  });

  it("rejects absolute fixture paths outside the bundled fixture directory", async () => {
    const result = await runReplay("--fixture", path.join(repoRoot, ".env.example"));

    expect(result.code).not.toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Fixture path must stay inside apps/server/fixtures/github");
  });
});

async function runReplay(...args: string[]) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      replayScript,
      "--url",
      "http://127.0.0.1:1/webhooks/github",
      "--secret",
      "test-secret",
      ...args
    ]);
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
