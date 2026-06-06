#!/usr/bin/env node
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const files = await listTrackedMarkdownFiles();
const failures = [];

for (const file of files) {
  const absoluteFile = path.join(repoRoot, file);
  const markdown = await readFile(absoluteFile, "utf8");

  for (const link of extractMarkdownLinks(markdown)) {
    const target = normalizeLocalTarget(link);
    if (!target) continue;

    const resolved = path.resolve(path.dirname(absoluteFile), target);
    if (!isInsideRepo(resolved) || !existsSync(resolved)) {
      failures.push(`${file}: ${link}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Broken local documentation links found:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Verified local links in ${files.length} markdown files.`);

async function listTrackedMarkdownFiles() {
  const { stdout } = await execFileAsync("git", ["ls-files", "*.md"], { cwd: repoRoot });
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

function extractMarkdownLinks(markdown) {
  const links = [];
  const inlineLinkPattern = /!?\[[^\]]*]\(([^)\s]+)(?:\s+['"][^)]*['"])?\)/g;
  for (const match of markdown.matchAll(inlineLinkPattern)) {
    if (match[1]) links.push(match[1]);
  }
  return links;
}

function normalizeLocalTarget(rawTarget) {
  const withoutAngles = rawTarget.replace(/^<(.+)>$/, "$1");
  if (!withoutAngles || withoutAngles.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(withoutAngles)) {
    return undefined;
  }

  const [withoutFragment] = withoutAngles.split("#");
  if (!withoutFragment) return undefined;

  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
}

function isInsideRepo(target) {
  return target === repoRoot || target.startsWith(`${repoRoot}${path.sep}`);
}
