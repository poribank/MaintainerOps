#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import path from "node:path";

const artifactPaths = process.argv.slice(2);
if (artifactPaths.length === 0) {
  throw new Error("Usage: node scripts/verify-package-artifacts.mjs <artifact.tgz>...");
}

const requirements = [
  {
    name: "@maintainerops/core",
    pattern: /^maintainerops-core-\d+\.\d+\.\d+.*\.tgz$/,
    required: ["package/dist/index.js", "package/dist/index.d.ts"]
  },
  {
    name: "@maintainerops/server",
    pattern: /^maintainerops-server-\d+\.\d+\.\d+.*\.tgz$/,
    required: ["package/dist/index.js", "package/dist/index.d.ts", "package/db/schema.sql"]
  },
  {
    name: "@maintainerops/web",
    pattern: /^maintainerops-web-\d+\.\d+\.\d+.*\.tgz$/,
    required: ["package/dist/index.html"]
  }
];

for (const requirement of requirements) {
  const artifactPath = artifactPaths.find((entry) => requirement.pattern.test(path.basename(entry)));
  if (!artifactPath) {
    throw new Error(`${requirement.name} package artifact was not found.`);
  }

  const entries = new Set(
    execFileSync("tar", ["-tzf", artifactPath], { encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
  );
  const missing = requirement.required.filter((entry) => !entries.has(entry));
  if (missing.length > 0) {
    throw new Error(`${requirement.name} package artifact is missing: ${missing.join(", ")}`);
  }

  console.log(`${requirement.name} package artifact contains required runtime files.`);
}
