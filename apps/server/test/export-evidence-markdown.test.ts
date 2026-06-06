import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

describe("evidence export markdown", () => {
  it("keeps exported work item and audit text on one markdown line", async () => {
    const server = createServer((request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(responseForPath(request.url ?? "/")));
    });

    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const port = (server.address() as AddressInfo).port;
      const outputDir = await mkdtemp(path.join(os.tmpdir(), "maintainerops-evidence-"));
      const { stdout } = await execFileAsync(process.execPath, [
        path.join(root, "scripts/export-evidence.mjs"),
        "--url",
        `http://127.0.0.1:${port}`,
        "--out",
        outputDir
      ]);
      const output = JSON.parse(stdout) as { markdownPath: string };
      const markdown = await readFile(output.markdownPath, "utf8");

      expect(markdown).toContain("- issue: Crash ## Injected heading (org/repo) risk=5");
      expect(markdown).toContain("- triage - fake list item: recorded by maintainer on org/repo");
      expect(markdown).not.toContain("\n## Injected heading");
      expect(markdown).not.toContain("\n- fake list item");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});

function responseForPath(url: string) {
  const path = new URL(url, "http://127.0.0.1").pathname;
  switch (path) {
    case "/readyz":
      return { ok: true, store: "memory", queue: "memory" };
    case "/api/queue":
      return {
        total: 1,
        count: 1,
        limit: 100,
        items: [
          {
            kind: "issue",
            title: "Crash\n## Injected heading",
            repository: { fullName: "org/repo" },
            analysis: { risk: { value: 5 } }
          }
        ]
      };
    case "/api/pilot/metrics":
      return {
        repositories: 1,
        workItems: { total: 1, open: 1 },
        recommendations: { total: 0, approvalGated: 0 },
        audit: { total: 1, aiAssists: 0, aiRawContentTransfers: 0 },
        jobs: { total: 0 }
      };
    case "/api/jobs":
      return { total: 0, items: [] };
    case "/api/audit-log":
      return {
        total: 1,
        count: 1,
        limit: 100,
        entries: [
          {
            action: "triage\n- fake list item",
            outcome: "recorded",
            actor: "maintainer",
            repository: "org/repo"
          }
        ]
      };
    default:
      return {};
  }
}
