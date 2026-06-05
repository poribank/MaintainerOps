import { execFile } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const tempDirs: string[] = [];

describe("evidence export CLI", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
  });

  it("exports API evidence as JSON and Markdown", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "maintainerops-evidence-test-"));
    tempDirs.push(outputDir);
    const server = createServer(handleEvidenceRequest);

    try {
      await listen(server);
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Test server did not bind to a TCP port.");
      }

      const { stdout } = await execFileAsync(
        process.execPath,
        ["scripts/export-evidence.mjs", "--url", `http://127.0.0.1:${address.port}`, "--out", outputDir],
        { cwd: repoRoot }
      );
      const exported = JSON.parse(stdout) as { jsonPath: string; markdownPath: string };
      const json = JSON.parse(await readFile(exported.jsonPath, "utf8")) as {
        readyz: { store: string; queue: string };
        queue: { total: number };
        metrics: { repositories: number };
      };
      const markdown = await readFile(exported.markdownPath, "utf8");

      expect(path.dirname(exported.jsonPath)).toBe(outputDir);
      expect(path.dirname(exported.markdownPath)).toBe(outputDir);
      expect(json.readyz).toMatchObject({ store: "memory", queue: "memory" });
      expect(json.queue.total).toBe(1);
      expect(json.metrics.repositories).toBe(1);
      expect(markdown).toContain("# MaintainerOps Evidence Export");
      expect(markdown).toContain("- issue: Pilot issue (org/repo) risk=12");
      expect(markdown).toContain("- triage: applied by maintainer on org/repo");
    } finally {
      await close(server);
    }
  });
});

function handleEvidenceRequest(request: IncomingMessage, response: ServerResponse): void {
  const payload = payloadForPath(request.url ?? "/");
  if (!payload) {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
    return;
  }

  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function payloadForPath(url: string): unknown {
  const pathName = new URL(url, "http://localhost").pathname;
  switch (pathName) {
    case "/readyz":
      return { ok: true, store: "memory", queue: "memory" };
    case "/api/queue":
      return {
        total: 1,
        items: [
          {
            kind: "issue",
            title: "Pilot issue",
            repository: { fullName: "org/repo" },
            analysis: { risk: { value: 12 } }
          }
        ]
      };
    case "/api/pilot/metrics":
      return {
        repositories: 1,
        workItems: { total: 1, open: 1 },
        recommendations: { total: 2, approvalGated: 1 },
        audit: { total: 1, aiAssists: 0, aiRawContentTransfers: 0 },
        jobs: { total: 1 }
      };
    case "/api/jobs":
      return { items: [{ type: "scan.scorecard", status: "completed", id: "job-1" }] };
    case "/api/audit-log":
      return { entries: [{ action: "triage", outcome: "applied", actor: "maintainer", repository: "org/repo" }] };
    default:
      return undefined;
  }
}

function listen(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
