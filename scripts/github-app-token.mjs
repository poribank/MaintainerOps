#!/usr/bin/env node
import { App } from "@octokit/app";
import { pathToFileURL } from "node:url";

export async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const appId = args.appId ?? env.GITHUB_APP_ID;
  const privateKey = normalizePrivateKey(args.privateKey ?? env.GITHUB_PRIVATE_KEY);
  const installationId = parseInstallationId(args.installationId ?? env.GITHUB_INSTALLATION_ID);
  const apiVersion = args.apiVersion ?? env.GITHUB_API_VERSION ?? "2026-03-10";

  if (!appId) {
    throw new Error("GITHUB_APP_ID or --app-id is required.");
  }
  if (!privateKey) {
    throw new Error("GITHUB_PRIVATE_KEY or --private-key is required.");
  }
  if (!installationId) {
    throw new Error("GITHUB_INSTALLATION_ID or --installation-id is required.");
  }

  const app = new App({ appId, privateKey });
  const request = {
    installation_id: installationId,
    headers: { "X-GitHub-Api-Version": apiVersion }
  };

  const repositoryName = parseRepositoryName(args.repository ?? env.GITHUB_REPOSITORY);
  if (repositoryName) {
    request.repositories = [repositoryName];
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
}

export function normalizePrivateKey(value) {
  return value?.replace(/\\n/g, "\n");
}

export function parseInstallationId(value) {
  if (!value) {
    return undefined;
  }
  if (!/^\d+$/.test(value.trim())) {
    throw new Error("GITHUB_INSTALLATION_ID or --installation-id must be a positive integer.");
  }
  const installationId = Number(value);
  if (!Number.isSafeInteger(installationId) || installationId < 1) {
    throw new Error("GITHUB_INSTALLATION_ID or --installation-id must be a positive integer.");
  }
  return installationId;
}

export function parseRepositoryName(repository) {
  if (!repository) {
    return undefined;
  }
  const parts = repository.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("--repository must use owner/name format.");
  }
  return parts[1];
}

export function parseArgs(argv) {
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

export function normalizeKey(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
