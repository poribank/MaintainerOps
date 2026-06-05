#!/usr/bin/env node
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "apps/server/fixtures/github");
const args = parseArgs(process.argv.slice(2));
const baseUrl = stripTrailingSlash(args.url ?? "http://localhost:3001");
const webhookUrl = args.webhookUrl ?? `${baseUrl}/webhooks/github`;
const secret = args.secret ?? process.env.GITHUB_WEBHOOK_SECRET ?? "dev-secret";

const replay = await replayFixtures();
const queue = await getJson(`${baseUrl}/api/queue`);
const firstItem = queue.items?.[0];
const action = firstItem ? await recordDryRunAction(firstItem.id) : undefined;
const ai = firstItem ? await requestAiPreview(firstItem.id) : undefined;
const job = await enqueueAndWaitForOsvJob();
const metrics = await getJson(`${baseUrl}/api/pilot/metrics`);

console.log(
  JSON.stringify(
    {
      baseUrl,
      replay,
      queue: {
        total: queue.total,
        selectedWorkItemId: firstItem?.id
      },
      action,
      ai,
      job,
      metrics: {
        workItems: metrics.workItems?.total,
        auditEntries: metrics.audit?.total,
        aiAssists: metrics.audit?.aiAssists,
        jobs: metrics.jobs?.total
      }
    },
    null,
    2
  )
);

async function replayFixtures() {
  const manifest = await readFixtureManifest();
  const results = [];

  for (const fixture of manifest.fixtures) {
    const body = await readFile(path.join(fixtureDir, fixture.path), "utf8");
    const event = fixture.event ?? eventFromFixtureName(fixture.path);
    const delivery = `demo-smoke-${event}-${randomUUID()}`;
    const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    const response = await fetchJson(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": event,
        "x-github-delivery": delivery,
        "x-hub-signature-256": signature
      },
      body
    });

    results.push({
      fixture: fixture.path,
      event,
      status: response.status,
      count: response.body.count ?? 0
    });
  }

  return results;
}

async function recordDryRunAction(workItemId) {
  const response = await fetchJson(`${baseUrl}/api/work-items/${encodeURIComponent(workItemId)}/actions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "write_check",
      actor: "demo-smoke",
      dryRun: true
    })
  });

  return {
    status: response.status,
    outcome: response.body.execution?.outcome,
    dryRun: response.body.execution?.dryRun
  };
}

async function requestAiPreview(workItemId) {
  const response = await fetchJson(`${baseUrl}/api/work-items/${encodeURIComponent(workItemId)}/ai-assist`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ includeRawContent: false, actor: "demo-smoke" })
  });

  return {
    status: response.status,
    enabled: response.body.assistance?.enabled,
    usedRawContent: response.body.assistance?.usedRawContent
  };
}

async function enqueueAndWaitForOsvJob() {
  const response = await fetchJson(`${baseUrl}/api/jobs/scans/osv`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: "." })
  });
  const jobId = response.body.job?.id;
  if (!jobId) return { status: response.status };

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const jobResponse = await fetchJson(`${baseUrl}/api/jobs/${encodeURIComponent(jobId)}`);
    const job = jobResponse.body.job;
    if (job?.status === "completed" || job?.status === "failed") {
      return {
        id: job.id,
        status: job.status,
        resultStatus: job.result?.status,
        error: job.error
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { id: jobId, status: "timeout" };
}

async function readFixtureManifest() {
  const manifest = await readJson(path.join(fixtureDir, "manifest.json"));
  if (!manifest || !Array.isArray(manifest.fixtures)) {
    throw new Error("Invalid fixture manifest.");
  }
  return manifest;
}

async function getJson(url) {
  return (await fetchJson(url)).body;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const body = parseJson(text);
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${text}`);
  }
  return { status: response.status, body };
}

async function readJson(filePath) {
  return parseJson(await readFile(filePath, "utf8"));
}

function eventFromFixtureName(name) {
  const baseName = path.basename(name);
  if (baseName.startsWith("pull_request.")) return "pull_request";
  if (baseName.startsWith("issues.")) return "issues";
  if (baseName.startsWith("release.")) return "release";
  if (baseName.startsWith("secret_scanning_alert.")) return "secret_scanning_alert";
  throw new Error(`Cannot infer GitHub event from fixture '${name}'.`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const value = argv[index + 1]?.startsWith("--") ? "true" : argv[index + 1] ?? "true";
    parsed[key] = value;
    if (value !== "true") {
      index += 1;
    }
  }
  return parsed;
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
