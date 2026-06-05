#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = parseArgs(process.argv.slice(2));
const baseUrl = normalizeBaseUrl(args.url ?? "http://localhost:3001");
const outputDir = path.resolve(root, args.out ?? "evidence");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonPath = path.join(outputDir, `maintainerops-evidence-${timestamp}.json`);
const markdownPath = path.join(outputDir, `maintainerops-evidence-${timestamp}.md`);

const evidence = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  readyz: await getJson(`${baseUrl}/readyz`),
  queue: await getJson(`${baseUrl}/api/queue`),
  metrics: await getJson(`${baseUrl}/api/pilot/metrics`),
  jobs: await getJson(`${baseUrl}/api/jobs`),
  audit: await getJson(`${baseUrl}/api/audit-log`)
};

await mkdir(outputDir, { recursive: true });
await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
await writeFile(markdownPath, renderMarkdown(evidence));

console.log(JSON.stringify({ jsonPath, markdownPath }, null, 2));

async function getJson(url) {
  const response = await fetch(url);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}: ${body}`);
  }
  return JSON.parse(body);
}

function renderMarkdown(data) {
  const items = data.queue.items ?? [];
  const metrics = data.metrics;
  const jobs = data.jobs.items ?? [];
  const audit = data.audit.entries ?? [];
  const lines = [
    "# MaintainerOps Evidence Export",
    "",
    `Generated at: ${data.generatedAt}`,
    "",
    "## Runtime",
    "",
    `- API URL: ${data.baseUrl}`,
    `- Store: ${data.readyz.store}`,
    `- Queue: ${data.readyz.queue}`,
    "",
    "## Pilot Metrics",
    "",
    `- Repositories: ${metrics.repositories}`,
    `- Work items: ${metrics.workItems.total}`,
    `- Open work items: ${metrics.workItems.open}`,
    `- Recommendations: ${metrics.recommendations.total}`,
    `- Approval-gated recommendations: ${metrics.recommendations.approvalGated}`,
    `- Audit entries: ${metrics.audit.total}`,
    `- AI assistance requests: ${metrics.audit.aiAssists}`,
    `- AI raw content transfers: ${metrics.audit.aiRawContentTransfers}`,
    `- Jobs: ${metrics.jobs.total}`,
    "",
    "## Work Items",
    ""
  ];

  for (const item of items.slice(0, 20)) {
    lines.push(`- ${item.kind}: ${item.title} (${item.repository.fullName}) risk=${item.analysis.risk.value}`);
  }

  lines.push("", "## Jobs", "");
  for (const job of jobs.slice(0, 20)) {
    lines.push(`- ${job.type}: ${job.status} (${job.id})`);
  }

  lines.push("", "## Audit", "");
  for (const entry of audit.slice(0, 20)) {
    lines.push(`- ${entry.action}: ${entry.outcome} by ${entry.actor} on ${entry.repository}`);
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- This export may contain repository names and metadata from the configured MaintainerOps instance.",
    "- Do not publish evidence from private repositories without maintainer authorization.",
    "- Raw repository content is not included in this export."
  );

  return `${lines.join("\n")}\n`;
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

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}
