#!/usr/bin/env node
import { App } from "@octokit/app";

const args = parseArgs(process.argv.slice(2));
const appId = args.appId ?? process.env.GITHUB_APP_ID;
const privateKey = normalizePrivateKey(args.privateKey ?? process.env.GITHUB_PRIVATE_KEY);
const installationId = parsePositiveInteger(args.installationId ?? process.env.GITHUB_INSTALLATION_ID);
const apiVersion = args.apiVersion ?? process.env.GITHUB_API_VERSION ?? "2026-03-10";
const repository = parseRepositorySelector(args.repository ?? process.env.GITHUB_REPOSITORY);

if (!appId) {
  throw new Error("GITHUB_APP_ID or --app-id is required.");
}
if (!privateKey) {
  throw new Error("GITHUB_PRIVATE_KEY or --private-key is required.");
}
if (installationId === undefined) {
  throw new Error("GITHUB_INSTALLATION_ID or --installation-id is required.");
}

const app = new App({ appId, privateKey });
const request = {
  installation_id: installationId,
  headers: { "X-GitHub-Api-Version": apiVersion }
};

if (repository) {
  request.repositories = [repository];
}

const response = await app.octokit.request("POST /app/installations/{installation_id}/access_tokens", request);

if (args.json === "true") {
  console.log(
    JSON.stringify(
      {
        token: response.data.token,
        expiresAt: response.data.expires_at,
        permissions: response.data.permissions,
        repositories: response.data.repositories?.map((repo) => repo.full_name)
      },
      null,
      2
    )
  );
} else if (args.env === "true") {
  console.log(`GITHUB_AUTH_TOKEN=${response.data.token}`);
} else {
  console.log(response.data.token);
}

function normalizePrivateKey(value) {
  return value?.replace(/\\n/g, "\n");
}

function parsePositiveInteger(value) {
  if (!value || !/^\d+$/.test(value.trim())) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseRepositorySelector(value) {
  if (!value) {
    return undefined;
  }
  const parts = value.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("--repository must use owner/name format.");
  }
  return parts[1];
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = normalizeKey(arg.slice(2));
    const value = argv[index + 1]?.startsWith("--") ? "true" : argv[index + 1] ?? "true";
    parsed[key] = value;
    if (value !== "true") {
      index += 1;
    }
  }
  return parsed;
}

function normalizeKey(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
