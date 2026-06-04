import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { MemoryJobQueue } from "../src/services/jobs.js";
import { SecurityScannerRunner } from "../src/services/scanners.js";

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
