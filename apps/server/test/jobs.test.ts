import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { MemoryJobQueue } from "../src/services/jobs.js";
import { SecurityScannerRunner, type ScannerResult } from "../src/services/scanners.js";

describe("MemoryJobQueue", () => {
  it("processes scan jobs asynchronously", async () => {
    const queue = new MemoryJobQueue(
      new SecurityScannerRunner(
        loadConfig({
          NODE_ENV: "test",
          SCORECARD_COMMAND: "maintainerops-scorecard-not-installed"
        })
      )
    );

    const job = await queue.enqueue("scan.scorecard", { repository: "org/repo" });
    expect(job.status).toBe("queued");

    const completed = await waitForJob(queue, job.id);
    expect(completed.status).toBe("completed");
    expect(completed.result?.status).toBe("unavailable");
  });

  it("normalizes list limits", async () => {
    const queue = new MemoryJobQueue(
      new SecurityScannerRunner(
        loadConfig({
          NODE_ENV: "test",
          OSV_SCANNER_COMMAND: "maintainerops-osv-not-installed"
        })
      )
    );

    await queue.enqueue("scan.osv", { path: "." });
    await queue.enqueue("scan.osv", { path: "." });

    await expect(queue.list(1)).resolves.toHaveLength(1);
    await expect(queue.list(0)).resolves.toHaveLength(1);
    await expect(queue.list(Number.NaN)).resolves.toHaveLength(2);
    await expect(queue.list(101)).resolves.toHaveLength(2);
  });

  it("does not expose mutable references to queued inputs or scanner results", async () => {
    const queue = new MemoryJobQueue(fakeScanners());
    const input = { repository: "org/repo" };

    const queued = await queue.enqueue("scan.scorecard", input);
    input.repository = "mutated/repo";
    queued.input.repository = "mutated/queued";

    const completed = await waitForJob(queue, queued.id);
    completed.input.repository = "mutated/completed";
    completed.result!.args.push("--mutated");
    (completed.result!.json as { findings: string[] }).findings.push("mutated");

    const listed = await queue.list();
    listed[0]!.input.repository = "mutated/listed";
    (listed[0]!.result!.json as { findings: string[] }).findings.push("mutated-list");

    const stored = await queue.get(queued.id);
    expect(stored).toMatchObject({
      input: { repository: "org/repo" },
      result: {
        args: ["--repo=org/repo"],
        json: { findings: ["original"] }
      }
    });
  });
});

async function waitForJob(queue: MemoryJobQueue, id: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const job = await queue.get(id);
    if (job?.status === "completed" || job?.status === "failed") {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Job did not finish.");
}

function fakeScanners(): SecurityScannerRunner {
  return {
    async runScorecard(repositoryFullName: string): Promise<ScannerResult> {
      return {
        scanner: "scorecard",
        status: "completed",
        command: "scorecard",
        args: [`--repo=${repositoryFullName}`],
        json: { findings: ["original"] }
      };
    },
    async runOsvScanner(): Promise<ScannerResult> {
      throw new Error("Unexpected OSV scanner call.");
    }
  } as SecurityScannerRunner;
}
