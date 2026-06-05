import { afterEach, describe, expect, it, vi } from "vitest";
import { getJson, parseArgs, renderMarkdown } from "./export-evidence.mjs";

describe("export-evidence script helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses flag arguments", () => {
    expect(parseArgs(["--url", "http://127.0.0.1:3001", "--out", "tmp/evidence", "--dry-run"])).toEqual({
      url: "http://127.0.0.1:3001",
      out: "tmp/evidence",
      "dry-run": "true"
    });
  });

  it("reads JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })));

    await expect(getJson("http://localhost/readyz")).resolves.toEqual({ ok: true });
  });

  it("includes endpoint context for HTTP failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not found\nwith details", { status: 404 })));

    await expect(getJson("http://localhost/api/queue")).rejects.toThrow(
      "http://localhost/api/queue returned 404: not found with details"
    );
  });

  it("includes endpoint context for invalid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>bad</html>", { status: 200 })));

    await expect(getJson("http://localhost/api/pilot/metrics")).rejects.toThrow(
      "http://localhost/api/pilot/metrics returned invalid JSON"
    );
  });

  it("renders evidence markdown with pilot metrics", () => {
    const markdown = renderMarkdown({
      generatedAt: "2026-06-05T00:00:00.000Z",
      baseUrl: "http://localhost:3001",
      readyz: { store: "memory", queue: "memory" },
      queue: {
        items: [
          {
            kind: "issue",
            title: "Demo issue",
            repository: { fullName: "org/repo" },
            analysis: { risk: { value: 5 } }
          }
        ]
      },
      metrics: {
        repositories: 1,
        workItems: { total: 1, open: 1 },
        recommendations: { total: 2, approvalGated: 1 },
        audit: { total: 3, aiAssists: 1, aiRawContentTransfers: 0 },
        jobs: { total: 1 }
      },
      jobs: { items: [{ type: "scan.osv", status: "completed", id: "mem-1" }] },
      audit: { entries: [{ action: "ai_assist", outcome: "recorded", actor: "demo", repository: "org/repo" }] }
    });

    expect(markdown).toContain("# MaintainerOps Evidence Export");
    expect(markdown).toContain("- Work items: 1");
    expect(markdown).toContain("- issue: Demo issue (org/repo) risk=5");
    expect(markdown).toContain("- scan.osv: completed (mem-1)");
    expect(markdown).toContain("- ai_assist: recorded by demo on org/repo");
  });
});
