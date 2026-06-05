#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));

if (args.help === "true") {
  printHelp();
  process.exit(0);
}

const repository = parseRepository(
  args.repository ?? process.env.GITHUB_REPOSITORY ?? "poribank/MaintainerOps"
);
if (!repository) {
  throw new Error("--repository must use owner/name format.");
}

const outputDir = path.resolve(root, args.out ?? "evidence");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonPath = path.join(outputDir, `maintainerops-repository-snapshot-${timestamp}.json`);
const markdownPath = path.join(outputDir, `maintainerops-repository-snapshot-${timestamp}.md`);
const headers = buildHeaders(process.env.GITHUB_AUTH_TOKEN);
const repositoryData = await getJson(`https://api.github.com/repos/${repository.owner}/${repository.name}`, headers);
const releasesData = await getJson(
  `https://api.github.com/repos/${repository.owner}/${repository.name}/releases?per_page=10`,
  headers
);

const snapshot = {
  generatedAt: new Date().toISOString(),
  repository: mapRepository(repositoryData),
  openIssues: await getOpenIssueCount(repository, headers),
  releases: releasesData.map(mapRelease),
  workflowRuns: await getWorkflowRuns(repository, headers)
};

await mkdir(outputDir, { recursive: true });
await writeFile(jsonPath, `${JSON.stringify(snapshot, null, 2)}\n`);
await writeFile(markdownPath, renderMarkdown(snapshot));

console.log(JSON.stringify({ jsonPath, markdownPath }, null, 2));

async function getOpenIssueCount(repository, headers) {
  const query = encodeURIComponent(`repo:${repository.owner}/${repository.name} is:issue is:open`);
  const result = await getJson(`https://api.github.com/search/issues?q=${query}&per_page=1`, headers);
  return result.total_count;
}

async function getWorkflowRuns(repository, headers) {
  try {
    const result = await getJson(
      `https://api.github.com/repos/${repository.owner}/${repository.name}/actions/runs?per_page=20`,
      headers
    );
    return result.workflow_runs.map(mapWorkflowRun);
  } catch (error) {
    return {
      unavailable: true,
      reason: error instanceof Error ? error.message : "Workflow run lookup failed."
    };
  }
}

async function getJson(url, headers) {
  const response = await fetch(url, { headers });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${body.slice(0, 500)}`);
  }
  return JSON.parse(body);
}

function renderMarkdown(data) {
  const repo = data.repository;
  const latestRelease = Array.isArray(data.releases) ? data.releases[0] : undefined;
  const workflowRuns = Array.isArray(data.workflowRuns) ? data.workflowRuns.slice(0, 10) : [];
  const workflowUnavailable = !Array.isArray(data.workflowRuns) ? data.workflowRuns.reason : undefined;
  const lines = [
    "# MaintainerOps Repository Snapshot",
    "",
    `Generated at: ${data.generatedAt}`,
    "",
    "## Repository",
    "",
    `- URL: ${repo.htmlUrl}`,
    `- Visibility: ${repo.private ? "private" : "public"}`,
    `- Default branch: ${repo.defaultBranch}`,
    `- Stars: ${repo.stars}`,
    `- Forks: ${repo.forks}`,
    `- Open issues: ${data.openIssues}`,
    `- GitHub open issues count: ${repo.githubOpenIssuesCount}`,
    `- License: ${repo.license ?? "unknown"}`,
    `- Created: ${repo.createdAt}`,
    `- Updated: ${repo.updatedAt}`,
    `- Pushed: ${repo.pushedAt}`,
    "",
    "## Releases",
    ""
  ];

  if (latestRelease) {
    lines.push(
      `- Latest release: ${latestRelease.tagName}`,
      `- Draft: ${latestRelease.draft}`,
      `- Prerelease: ${latestRelease.prerelease}`,
      `- Published: ${latestRelease.publishedAt ?? "not published"}`
    );
  } else {
    lines.push("- No releases returned by the GitHub releases API.");
  }

  lines.push("", "## Recent Workflow Runs", "");
  if (workflowUnavailable) {
    lines.push(`- Unavailable: ${workflowUnavailable}`);
  } else if (workflowRuns.length === 0) {
    lines.push("- No workflow runs returned by the GitHub Actions API.");
  } else {
    for (const run of workflowRuns) {
      lines.push(
        `- ${run.name}: ${run.status}/${run.conclusion ?? "pending"} on ${run.headBranch} at ${run.createdAt}`
      );
    }
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- Open issues are counted with GitHub search using `is:issue is:open`, so pull requests are excluded.",
    "- GitHub `open_issues_count` is included separately because it includes pull requests.",
    "- Review generated snapshots before attaching them to an application or public issue."
  );

  return `${lines.join("\n")}\n`;
}

function mapRepository(repo) {
  return {
    id: repo.id,
    fullName: repo.full_name,
    htmlUrl: repo.html_url,
    private: repo.private,
    defaultBranch: repo.default_branch,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    githubOpenIssuesCount: repo.open_issues_count,
    license: repo.license?.spdx_id ?? null,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at
  };
}

function mapRelease(release) {
  return {
    id: release.id,
    tagName: release.tag_name,
    name: release.name,
    htmlUrl: release.html_url,
    draft: release.draft,
    prerelease: release.prerelease,
    createdAt: release.created_at,
    publishedAt: release.published_at
  };
}

function mapWorkflowRun(run) {
  return {
    id: run.id,
    name: run.name,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    headBranch: run.head_branch,
    headSha: run.head_sha,
    htmlUrl: run.html_url,
    createdAt: run.created_at,
    updatedAt: run.updated_at
  };
}

function buildHeaders(token) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "maintainerops-repository-snapshot",
    "x-github-api-version": process.env.GITHUB_API_VERSION || "2026-03-10"
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function parseRepository(value) {
  const [owner, name, extra] = value.split("/");
  if (!owner || !name || extra) return undefined;
  return { owner, name };
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
  console.log(`Usage: npm run evidence:repo-snapshot -- --repository owner/name

Exports public GitHub repository facts for application or pilot evidence.

Options:
  --repository owner/name      Repository to inspect. Defaults to GITHUB_REPOSITORY or poribank/MaintainerOps.
  --out directory              Output directory. Defaults to evidence.
  --help                       Show this help.

Set GITHUB_AUTH_TOKEN to use an authenticated GitHub API request without saving the token.
`);
}
