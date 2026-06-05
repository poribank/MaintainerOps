import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { AppConfig } from "../config.js";

const execFileAsync = promisify(execFile);

export interface ScannerResult {
  scanner: "scorecard" | "osv-scanner";
  status: "completed" | "unavailable" | "failed";
  command: string;
  args: string[];
  json?: unknown;
  stdout?: string | undefined;
  stderr?: string | undefined;
  error?: string | undefined;
}

export class SecurityScannerRunner {
  constructor(private readonly config: AppConfig) {}

  async runScorecard(repositoryFullName: string): Promise<ScannerResult> {
    assertRepositoryFullName(repositoryFullName);
    const args = [`--repo=github.com/${repositoryFullName}`, "--format=json"];
    return runJsonCommand("scorecard", this.config.scanners.scorecardCommand, args, this.config.scanners.timeoutMs);
  }

  async runOsvScanner(targetPath: string): Promise<ScannerResult> {
    const resolvedPath = resolveSafePath(this.config.scanners.workspaceRoot, targetPath);
    const args = ["scan", "source", "--format", "json", "-r", resolvedPath];
    return runJsonCommand("osv-scanner", this.config.scanners.osvScannerCommand, args, this.config.scanners.timeoutMs);
  }
}

async function runJsonCommand(
  scanner: ScannerResult["scanner"],
  command: string,
  args: string[],
  timeoutMs: number
): Promise<ScannerResult> {
  try {
    const result = await execFileAsync(command, args, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 20
    });
    return {
      scanner,
      status: "completed",
      command,
      args,
      stdout: result.stdout,
      stderr: result.stderr,
      json: parseOptionalJson(result.stdout)
    };
  } catch (error) {
    const executionError = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    const stdout = executionError.stdout ?? "";
    const parsedJson = parseOptionalJson(stdout);

    if (executionError.code === "ENOENT") {
      return {
        scanner,
        status: "unavailable",
        command,
        args,
        error: `${command} was not found on PATH.`
      };
    }

    if (parsedJson) {
      return {
        scanner,
        status: "completed",
        command,
        args,
        stdout,
        stderr: executionError.stderr,
        json: parsedJson
      };
    }

    return {
      scanner,
      status: "failed",
      command,
      args,
      stdout,
      stderr: executionError.stderr,
      error: executionError.message
    };
  }
}

function parseOptionalJson(value: string): unknown | undefined {
  try {
    return value.trim().length > 0 ? (JSON.parse(value) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

export function assertRepositoryFullName(value: string): void {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) {
    throw new Error("Repository must be in owner/name format.");
  }
}

export function resolveSafePath(workspaceRoot: string, targetPath: string): string {
  const base = path.resolve(workspaceRoot);
  const baseRealPath = realpathOrResolved(base);
  const resolved = path.resolve(base, targetPath || ".");
  const resolvedRealPath = realpathOrResolved(resolved);

  if (resolvedRealPath !== baseRealPath && !resolvedRealPath.startsWith(`${baseRealPath}${path.sep}`)) {
    throw new Error("OSV scan path must be inside the MaintainerOps workspace.");
  }
  return resolved;
}

function realpathOrResolved(value: string): string {
  try {
    return realpathSync(value);
  } catch {
    return value;
  }
}
