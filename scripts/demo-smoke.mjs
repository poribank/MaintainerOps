#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "apps/server/fixtures/github");
const args = parseArgs(process.argv.slice(2));
const secret = args.secret ?? process.env.GITHUB_WEBHOOK_SECRET ?? "dev-secret";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve(root, args.out ?? path.join("evidence", `demo-smoke-${timestamp}`));
const externalBaseUrl = args.url ? stripTrailingSlash(args.url) : undefined;
const port = Number.parseInt(args.port ?? "", 10) || (externalBaseUrl ? undefined : await findOpenPort());
const baseUrl = externalBaseUrl ?? `http://127.0.0.1:${port}`;
const webhookUrl = args.webhookUrl ?? `${baseUrl}/webhooks/github`;
const skipBuild = args.skipBuild === "true" || args["skip-build"] === "true";

let server;

try {
  if (!externalBaseUrl && !skipBuild) {
    await runCommand("npm", ["run", "build"]);
  }

  await mkdir(outputDir, { recursive: true });

  if (!externalBaseUrl) {
    server = startServer(port);
  }

  await waitForReady(`${baseUrl}/readyz`, server);

  const replay = await replayFixtures();
  const queue = await getJson(`${baseUrl}/api/queue`);
  const firstItem = queue.items?.[0];
  const action = firstItem ? await recordDryRunAction(firstItem.id) : undefined;
  const ai = firstItem ? await requestAiPreview(firstItem.id) : undefined;
  const job = await enqueueAndWaitForOsvJob();
  const evidence = await exportEvidence();
  const metrics = await getJson(`${baseUrl}/api/pilot/metrics`);

  assertDemoState({ queue, metrics, replay, action, ai, job });

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        evidenceDir: outputDir,
        replay,
        queue: {
          total: queue.total,
          kinds: Array.from(new Set(queue.items.map((item) => item.kind))).sort(),
          selectedWorkItemId: firstItem?.id
        },
        action,
        ai,
        job,
        evidence,
        metrics: {
          repositories: metrics.repositories,
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
} finally {
  await stopServer(server);
}

function startServer(port) {
  const child = execFile(process.execPath, [path.join(root, "apps/server/dist/index.js")], {
    cwd: root,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      GITHUB_WEBHOOK_SECRET: secret,
      SEED_DEMO_DATA: "false"
    }
  });

  child.stdout?.on("data", (chunk) => {
    process.stderr.write(prefixLines("server", chunk));
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(prefixLines("server", chunk));
  });

  return child;
}

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
    await sleep(100);
  }

  return { id: jobId, status: "timeout" };
}

async function exportEvidence() {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      path.join(root, "scripts/export-evidence.mjs"),
      "--url",
      baseUrl,
      "--out",
      path.relative(root, outputDir)
    ],
    { cwd: root }
  );
  return parseJson(stdout);
}

function assertDemoState({ queue, metrics, replay, action, ai, job }) {
  if (!Array.isArray(replay) || replay.some((entry) => entry.status !== 202 || entry.count !== 1)) {
    throw new Error("Fixture replay did not create one work item per fixture.");
  }

  if (!queue || !Array.isArray(queue.items) || queue.items.length < 4) {
    throw new Error("Queue response did not include the expected demo work items.");
  }

  const kinds = new Set(queue.items.map((item) => item.kind));
  for (const kind of ["pull_request", "issue", "release", "security"]) {
    if (!kinds.has(kind)) {
      throw new Error(`Expected demo replay to create a ${kind} work item.`);
    }
  }

  if (action?.status !== 202 || action?.outcome !== "recorded" || action?.dryRun !== true) {
    throw new Error("Dry-run write action did not record as expected.");
  }

  if (ai?.status !== 200 || ai?.usedRawContent !== false) {
    throw new Error("AI preview did not preserve metadata-only behavior.");
  }

  if (job?.status !== "completed" && job?.status !== "failed") {
    throw new Error("OSV background job did not reach a terminal state.");
  }

  if (!metrics || metrics.workItems?.total !== queue.items.length) {
    throw new Error("Pilot metrics work item count did not match the queue.");
  }
}

async function readFixtureManifest() {
  const manifest = await readJson(path.join(fixtureDir, "manifest.json"));
  if (!manifest || !Array.isArray(manifest.fixtures)) {
    throw new Error("Invalid fixture manifest.");
  }
  return manifest;
}

async function waitForReady(url, child) {
  const startedAt = Date.now();
  let exit;
  child?.once("exit", (code, signal) => {
    exit = { code, signal };
  });

  while (Date.now() - startedAt < 15000) {
    if (exit) {
      throw new Error(`Server exited before becoming ready: ${JSON.stringify(exit)}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Keep polling until the server accepts connections or the timeout expires.
    }
    await sleep(250);
  }

  throw new Error(`Server did not become ready within 15s at ${url}`);
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

async function runCommand(command, commandArgs) {
  await new Promise((resolve, reject) => {
    const child = execFile(command, commandArgs, { cwd: root, env: process.env });
    child.stdout?.on("data", (chunk) => process.stderr.write(chunk));
    child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${commandArgs.join(" ")} exited with ${code ?? signal}`));
    });
  });
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    sleep(5000).then(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    })
  ]);
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
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
    const key = camelCase(rawKey);
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
      continue;
    }
    const value = argv[index + 1]?.startsWith("--") ? "true" : argv[index + 1] ?? "true";
    parsed[key] = value;
    if (value !== "true") index += 1;
  }
  return parsed;
}

async function findOpenPort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a local TCP port."));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function camelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function prefixLines(prefix, chunk) {
  return String(chunk)
    .split("\n")
    .map((line, index, lines) => (index === lines.length - 1 && line.length === 0 ? "" : `[${prefix}] ${line}`))
    .join("\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
