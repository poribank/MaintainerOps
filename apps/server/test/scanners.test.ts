import { chmod, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { SecurityScannerRunner } from "../src/services/scanners.js";

describe("SecurityScannerRunner", () => {
  it("reports unavailable scanners without throwing", async () => {
    const runner = new SecurityScannerRunner(
      loadConfig({
        NODE_ENV: "test",
        SCORECARD_COMMAND: "maintainerops-scorecard-not-installed",
        OSV_SCANNER_COMMAND: "maintainerops-osv-not-installed"
      })
    );

    await expect(runner.runScorecard("org/repo")).resolves.toMatchObject({
      scanner: "scorecard",
      status: "unavailable"
    });
    await expect(runner.runOsvScanner(".")).resolves.toMatchObject({
      scanner: "osv-scanner",
      status: "unavailable"
    });
  });

  it("rejects unsafe scan inputs", async () => {
    const runner = new SecurityScannerRunner(loadConfig({ NODE_ENV: "test" }));

    await expect(runner.runScorecard("bad repo")).rejects.toThrow("owner/name");
    await expect(runner.runOsvScanner("../")).rejects.toThrow("inside the MaintainerOps workspace");
  });

  it("resolves OSV scan paths from the configured workspace root", async () => {
    const runner = new SecurityScannerRunner(
      loadConfig({
        NODE_ENV: "test",
        INIT_CWD: "/tmp/maintainerops-root",
        OSV_SCANNER_COMMAND: "maintainerops-osv-not-installed"
      })
    );

    const result = await runner.runOsvScanner(".");

    expect(result.args).toContain("/tmp/maintainerops-root");
    await expect(runner.runOsvScanner("../")).rejects.toThrow("inside the MaintainerOps workspace");
  });

  it("rejects OSV scan paths that escape through symlinks", async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), "maintainerops-workspace-"));
    const outside = await mkdtemp(path.join(os.tmpdir(), "maintainerops-outside-"));
    await symlink(outside, path.join(workspace, "outside-link"), "dir");
    const runner = new SecurityScannerRunner(
      loadConfig({
        NODE_ENV: "test",
        INIT_CWD: workspace,
        OSV_SCANNER_COMMAND: "maintainerops-osv-not-installed"
      })
    );

    await expect(runner.runOsvScanner("outside-link")).rejects.toThrow("inside the MaintainerOps workspace");
  });

  it("returns failed when a scanner command times out", async () => {
    const command = await writeExecutable("sleep-scanner", "sleep 1\n");
    const runner = new SecurityScannerRunner(
      loadConfig({
        NODE_ENV: "test",
        SCORECARD_COMMAND: command,
        SCANNER_TIMEOUT_MS: "10"
      })
    );

    await expect(runner.runScorecard("org/repo")).resolves.toMatchObject({
      scanner: "scorecard",
      status: "failed",
      command
    });
  });

  it("keeps scanner JSON output when the command exits non-zero", async () => {
    const command = await writeExecutable("json-scanner", "printf '{\"results\":[{\"id\":\"GHSA-demo\"}]}'\nexit 2\n");
    const runner = new SecurityScannerRunner(
      loadConfig({
        NODE_ENV: "test",
        OSV_SCANNER_COMMAND: command
      })
    );

    await expect(runner.runOsvScanner(".")).resolves.toMatchObject({
      scanner: "osv-scanner",
      status: "completed",
      command,
      json: { results: [{ id: "GHSA-demo" }] }
    });
  });
});

async function writeExecutable(name: string, body: string): Promise<string> {
  const directory = path.join(os.tmpdir(), `maintainerops-scanner-test-${process.pid}`);
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, name);
  await writeFile(filePath, `#!/usr/bin/env sh\n${body}`);
  await chmod(filePath, 0o700);
  return filePath;
}
