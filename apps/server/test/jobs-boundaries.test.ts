import { describe, expect, it } from "vitest";
import { MemoryJobQueue, type MaintainerJob } from "../src/services/jobs.js";
import type { ScannerResult, SecurityScannerRunner } from "../src/services/scanners.js";

describe("MemoryJobQueue failure boundaries", () => {
  it("records scanner failures without losing the original job input", async () => {
    const queue = new MemoryJobQueue(failingScanners("scorecard unavailable"));
    const queued = await queue.enqueue("scan.scorecard", { repository: "org/repo" });

    const failed = await waitForTerminalJob(queue, queued.id);
    expect(failed).toMatchObject({
      id: queued.id,
      type: "scan.scorecard",
      status: "failed",
      input: { repository: "org/repo" }
    });
    expect(failed.error).toContain("scorecard unavailable");
    expect(failed.result).toBeUndefined();
  });

  it("returns cloned job inputs and results to callers", async () => {
    const queue = new MemoryJobQueue(successfulScanners());
    const queued = await queue.enqueue("scan.osv", { path: "." });
    const completed = await waitForTerminalJob(queue, queued.id);

    completed.input.path = "../mutated";
    if (completed.result) {
      completed.result.status = "failed";
      completed.result.error = "mutated";
    }

    const fresh = await queue.get(queued.id);
    expect(fresh).toMatchObject({
      status: "completed",
      input: { path: "." },
      result: { status: "unavailable", error: "Scanner unavailable in test." }
    });
  });
});

function failingScanners(message: string): SecurityScannerRunner {
  return {
    async runScorecard() {
      throw new Error(message);
    },
    async runOsvScanner() {
      throw new Error(message);
    }
  } as SecurityScannerRunner;
}

function successfulScanners(): SecurityScannerRunner {
  const result: ScannerResult = {
    scanner: "osv-scanner",
    status: "unavailable",
    command: "osv-scanner",
    args: ["scan", "source", "."],
    error: "Scanner unavailable in test."
  };
  return {
    async runScorecard() {
      return result;
    },
    async runOsvScanner() {
      return result;
    }
  } as SecurityScannerRunner;
}

async function waitForTerminalJob(queue: MemoryJobQueue, id: string): Promise<MaintainerJob> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const job = await queue.get(id);
    if (job?.status === "completed" || job?.status === "failed") {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Job did not finish.");
}
