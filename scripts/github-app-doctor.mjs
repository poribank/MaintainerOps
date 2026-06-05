#!/usr/bin/env node
import { App } from "@octokit/app";

const args = parseArgs(process.argv.slice(2));

if (args.help === "true") {
  printHelp();
  process.exit(0);
}

const appId = args.appId ?? process.env.GITHUB_APP_ID;
const privateKey = normalizePrivateKey(args.privateKey ?? process.env.GITHUB_PRIVATE_KEY);
const installationId = Number.parseInt(args.installationId ?? process.env.GITHUB_INSTALLATION_ID ?? "", 10);
const apiVersion = args.apiVersion ?? process.env.GITHUB_API_VERSION ?? "2026-03-10";
const repository = args.repository ?? process.env.GITHUB_REPOSITORY;
const requireReleaseDrafts = args.requireReleaseDrafts === "true";
const requireAdministration = args.requireAdministration === "true";
const outputJson = args.json === "true";

if (!appId) {
  throw new Error("GITHUB_APP_ID or --app-id is required.");
}
if (!privateKey) {
  throw new Error("GITHUB_PRIVATE_KEY or --private-key is required.");
}
if (!Number.isFinite(installationId)) {
  throw new Error("GITHUB_INSTALLATION_ID or --installation-id is required.");
}
if (repository && !repository.includes("/")) {
  throw new Error("--repository must use owner/name format.");
}

const requiredPermissions = {
  metadata: "read",
  checks: "write",
  issues: "write",
  pull_requests: "write",
  contents: requireReleaseDrafts ? "write" : "read"
};

if (requireAdministration) {
  requiredPermissions.administration = "write";
}

const app = new App({ appId, privateKey });
const headers = { "X-GitHub-Api-Version": apiVersion };
const installation = await app.octokit.request("GET /app/installations/{installation_id}", {
  installation_id: installationId,
  headers
});
const permissions = installation.data.permissions ?? {};
const permissionResults = comparePermissions(permissions, requiredPermissions);
const repositoryResult = repository ? await verifyRepository(app, installationId, repository, headers) : undefined;
const ok = permissionResults.every((result) => result.ok) && (repositoryResult?.ok ?? true);

const result = {
  ok,
  installation: {
    id: installation.data.id,
    account: installation.data.account?.login,
    targetType: installation.data.target_type,
    repositorySelection: installation.data.repository_selection
  },
  requiredPermissions,
  permissions,
  permissionResults,
  repository: repositoryResult
};

if (outputJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  printHumanResult(result);
}

process.exit(ok ? 0 : 1);

async function verifyRepository(app, installationId, repository, headers) {
  const [owner, repo] = repository.split("/");
  const octokit = await app.getInstallationOctokit(installationId);

  try {
    const response = await octokit.request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
      headers
    });
    return {
      ok: true,
      fullName: response.data.full_name,
      private: response.data.private,
      defaultBranch: response.data.default_branch
    };
  } catch (error) {
    return {
      ok: false,
      fullName: repository,
      reason: error instanceof Error ? error.message : "Repository access check failed."
    };
  }
}

function comparePermissions(actual, required) {
  return Object.entries(required).map(([name, expected]) => {
    const current = actual[name] ?? "none";
    return {
      name,
      expected,
      actual: current,
      ok: permissionLevel(current) >= permissionLevel(expected)
    };
  });
}

function permissionLevel(value) {
  switch (value) {
    case "write":
      return 2;
    case "read":
      return 1;
    default:
      return 0;
  }
}

function printHumanResult(result) {
  console.log(`GitHub App installation ${result.ok ? "OK" : "needs attention"}`);
  console.log(`Installation: ${result.installation.account ?? "unknown"} (${result.installation.id})`);
  console.log(`Repository selection: ${result.installation.repositorySelection}`);

  if (result.repository) {
    console.log(
      `Repository: ${result.repository.fullName} ${result.repository.ok ? "accessible" : `not accessible: ${result.repository.reason}`}`
    );
  }

  console.log("Permissions:");
  for (const permission of result.permissionResults) {
    const marker = permission.ok ? "OK" : "MISSING";
    console.log(`- ${marker} ${permission.name}: expected ${permission.expected}, actual ${permission.actual}`);
  }
}

function normalizePrivateKey(value) {
  return value?.replace(/\\n/g, "\n");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
    const key = normalizeKey(rawKey);
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

function normalizeKey(value) {
  return value.replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
}

function printHelp() {
  console.log(`Usage: npm run github:doctor -- [options]

Checks a GitHub App installation without creating repository changes.

Options:
  --installation-id <id>          GitHub App installation id. Defaults to GITHUB_INSTALLATION_ID.
  --repository <owner/name>       Verify the installation can read this repository.
  --require-release-drafts        Require Contents: write for create_release_draft.
  --require-administration        Require Administration: write for admin/ruleset pilots.
  --json                          Print machine-readable JSON.
  --help                          Show this help.
`);
}
