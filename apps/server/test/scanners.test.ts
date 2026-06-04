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
});
