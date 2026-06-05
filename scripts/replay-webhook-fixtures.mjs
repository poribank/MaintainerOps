#!/usr/bin/env node
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "apps/server/fixtures/github");
const args = parseArgs(process.argv.slice(2));
const url = args.url ?? "http://localhost:3001/webhooks/github";
const secret = args.secret ?? process.env.GITHUB_WEBHOOK_SECRET ?? "dev-secret";
const selected = args.fixture ? [args.fixture] : await readManifestFixturePaths();

for (const fixturePath of selected) {
  const fullPath = path.isAbsolute(fixturePath) ? fixturePath : path.join(fixtureDir, fixturePath);
  const body = await readFile(fullPath, "utf8");
  const event = args.event ?? eventFromFixtureName(path.basename(fixturePath));
  const delivery = `${args.deliveryPrefix ?? "demo"}-${event}-${randomUUID()}`;
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": event,
      "x-github-delivery": delivery,
      "x-hub-signature-256": signature
    },
    body
  });
  const responseBody = await response.text();
  console.log(
    JSON.stringify(
      {
        fixture: path.relative(root, fullPath),
        event,
        delivery,
        status: response.status,
        response: parseJson(responseBody)
      },
      null,
      2
    )
  );

  if (!response.ok) {
    process.exitCode = 1;
  }
}

async function readManifestFixturePaths() {
  const manifest = parseJson(await readFile(path.join(fixtureDir, "manifest.json"), "utf8"));
  if (!manifest || !Array.isArray(manifest.fixtures)) {
    throw new Error("Invalid fixture manifest.");
  }
  return manifest.fixtures.map((fixture) => fixture.path);
}

function eventFromFixtureName(name) {
  if (name.startsWith("pull_request.")) return "pull_request";
  if (name.startsWith("issues.")) return "issues";
  if (name.startsWith("release.")) return "release";
  if (name.startsWith("secret_scanning_alert.")) return "secret_scanning_alert";
  throw new Error(`Cannot infer GitHub event from fixture '${name}'. Use --event.`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
    const key = camelCase(rawKey);
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
      continue;
    }
    const value = argv[index + 1]?.startsWith("--") ? "true" : argv[index + 1] ?? "true";
    parsed[key] = value;
    if (value !== "true") {
      index += 1;
    }
  }
  return parsed;
}

function camelCase(value) {
  return value.replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
