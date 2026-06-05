#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const port = Number.parseInt(args.port ?? "", 10) || (await findOpenPort());
const secret = args.secret ?? "dev-secret";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.resolve(root, args.out ?? path.join("evidence", `demo-smoke-${timestamp}`));
const baseUrl = `http://127.0.0.1:${port}`;
const serverEntry = path.join(root, "apps/server/dist/index.js");
const skipBuild = args["skip-build"] === "true";

let server;

try {
  if (!skipBuild) {
    await runCommand("npm", ["run", "build"]);
  }

  await mkdir(outputDir, { recursive: true });
  server = startServer();
  await waitForReady(server, `${baseUrl}/healthz`);

  await runCommand(process.execPath, [
    path.join(root, "scripts/replay-webhook-fixtures.mjs"),
    "--url",
    `${baseUrl}/webhooks/github`,
    "--secret",
    secret
  ]);

  await runCommand(process.execPath, [
    path.join(root, "scripts/export-evidence.mjs"),
    "--url",
    baseUrl,
    "--out",
    path.relative(root, outputDir)
  ]);

  const queue = await getJson(`${baseUrl}/api/queue`);
  const metrics = await getJson(`${baseUrl}/api/pilot/metrics`);
  assertDemoState(queue, metrics);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        evidenceDir: outputDir,
        workItems: queue.total,
        repositories: metrics.repositories,
        kinds: Array.from(new Set(queue.items.map((item) => item.kind))).sort()
      },
      null,
      2
    )
  );
} finally {
  await stopServer(server);
}

function startServer() {
  const child = spawn(process.execPath, [serverEntry], {
    cwd: root,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      GITHUB_WEBHOOK_SECRET: secret,
      SEED_DEMO_DATA: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(prefixLines("server", chunk));
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(prefixLines("server", chunk));
  });

  return child;
}

async function waitForReady(child, url) {
  const startedAt = Date.now();
  let exit;
  child.once("exit", (code, signal) => {
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

async function runCommand(command, commandArgs) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd: root,
      env: process.env,
      stdio: "inherit"
    });
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

async function getJson(url) {
  const response = await fetch(url);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${body}`);
  }
  return JSON.parse(body);
}

function assertDemoState(queue, metrics) {
  if (!queue || !Array.isArray(queue.items)) {
    throw new Error("Queue response did not include work items.");
  }
  if (queue.items.length < 4) {
    throw new Error(`Expected at least 4 demo work items, received ${queue.items.length}.`);
  }

  const kinds = new Set(queue.items.map((item) => item.kind));
  for (const kind of ["pull_request", "issue", "release", "security"]) {
    if (!kinds.has(kind)) {
      throw new Error(`Expected demo replay to create a ${kind} work item.`);
    }
  }

  if (!metrics || metrics.workItems?.total !== queue.items.length) {
    throw new Error("Pilot metrics work item count did not match the queue.");
  }
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

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    const value = next && !next.startsWith("--") ? next : "true";
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

function prefixLines(prefix, chunk) {
  return String(chunk)
    .split("\n")
    .map((line, index, lines) => (index === lines.length - 1 && line.length === 0 ? "" : `[${prefix}] ${line}`))
    .join("\n");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
