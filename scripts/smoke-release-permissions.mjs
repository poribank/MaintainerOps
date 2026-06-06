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
const repository = parseRepository(args.repository ?? process.env.GITHUB_REPOSITORY);
const targetCommitish = args.target ?? "main";
const keepRelease = args.keepRelease === "true";

if (!appId) {
  throw new Error("GITHUB_APP_ID or --app-id is required.");
}
if (!privateKey) {
  throw new Error("GITHUB_PRIVATE_KEY or --private-key is required.");
}
if (!Number.isFinite(installationId)) {
  throw new Error("GITHUB_INSTALLATION_ID or --installation-id is required.");
}
if (!repository) {
  throw new Error("GITHUB_REPOSITORY or --repository owner/name is required.");
}

const tagName = `maintainerops-release-smoke-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
const assetName = `${tagName}.json`;
const assetLabel = "MaintainerOps release permission smoke evidence";
const assetBody = Buffer.from(
  `${JSON.stringify(
    {
      purpose: "MaintainerOps release permission smoke test",
      repository: repository.fullName,
      tagName,
      targetCommitish,
      createdAt: new Date().toISOString()
    },
    null,
    2
  )}\n`
);

const app = new App({ appId, privateKey });
const octokit = await app.getInstallationOctokit(installationId);
const headers = { "X-GitHub-Api-Version": apiVersion };
const events = [];
let release;
let asset;

try {
  const createResponse = await octokit.request("POST /repos/{owner}/{repo}/releases", {
    owner: repository.owner,
    repo: repository.repo,
    tag_name: tagName,
    target_commitish: targetCommitish,
    name: tagName,
    body: "MaintainerOps GitHub App release permission smoke test. This draft is deleted after verification.",
    draft: true,
    prerelease: true,
    headers
  });
  release = createResponse.data;
  events.push({ event: "created_draft_release", releaseId: release.id, url: release.html_url });

  const uploadResponse = await octokit.request({
    method: "POST",
    url: buildUploadUrl(release.upload_url, assetName, assetLabel),
    data: assetBody,
    headers: {
      ...headers,
      "content-type": "application/json",
      "content-length": assetBody.byteLength
    }
  });
  asset = uploadResponse.data;
  events.push({ event: "uploaded_asset", assetId: asset.id, name: asset.name, size: asset.size });
} finally {
  if (!keepRelease) {
    await cleanup({ octokit, headers, repository, tagName, release, asset, events });
  }
}

console.log(
  JSON.stringify(
    {
      repository: repository.fullName,
      tagName,
      targetCommitish,
      keepRelease,
      events
    },
    null,
    2
  )
);

async function cleanup({ octokit, headers, repository, tagName, release, asset, events }) {
  if (asset) {
    await octokit.request("DELETE /repos/{owner}/{repo}/releases/assets/{asset_id}", {
      owner: repository.owner,
      repo: repository.repo,
      asset_id: asset.id,
      headers
    });
    events.push({ event: "deleted_asset", assetId: asset.id });
  }

  if (release) {
    await octokit.request("DELETE /repos/{owner}/{repo}/releases/{release_id}", {
      owner: repository.owner,
      repo: repository.repo,
      release_id: release.id,
      headers
    });
    events.push({ event: "deleted_draft_release", releaseId: release.id });
  }

  try {
    await octokit.request("DELETE /repos/{owner}/{repo}/git/refs/tags/{tag}", {
      owner: repository.owner,
      repo: repository.repo,
      tag: tagName,
      headers
    });
    events.push({ event: "deleted_tag_ref", tagName });
  } catch (error) {
    if (error.status === 404 || error.status === 422) {
      events.push({ event: "no_tag_ref_created", tagName });
      return;
    }
    throw error;
  }
}

function buildUploadUrl(uploadUrl, name, label) {
  const baseUrl = uploadUrl.replace("{?name,label}", "");
  const params = new URLSearchParams({ name, label });
  return `${baseUrl}?${params.toString()}`;
}

function parseRepository(value) {
  const [owner, repo, extra] = value?.split("/") ?? [];
  if (!owner || !repo || extra) return undefined;
  return { owner, repo, fullName: `${owner}/${repo}` };
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

function printHelp() {
  console.log(`Usage: npm run github:release-smoke -- --repository owner/name

Creates a draft GitHub Release, uploads a small JSON asset, then deletes both by default.

Options:
  --repository owner/name      Repository to verify. Defaults to GITHUB_REPOSITORY.
  --installation-id id         GitHub App installation id. Defaults to GITHUB_INSTALLATION_ID.
  --app-id id                  GitHub App id. Defaults to GITHUB_APP_ID.
  --private-key key            GitHub App private key. Defaults to GITHUB_PRIVATE_KEY.
  --api-version version        GitHub API version. Defaults to GITHUB_API_VERSION or 2026-03-10.
  --target ref                 Target commitish for the draft release. Defaults to main.
  --keep-release               Leave the draft release and uploaded asset in GitHub.
  --help                       Show this help.
`);
}
