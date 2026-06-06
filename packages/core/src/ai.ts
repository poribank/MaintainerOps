import type { MaintainerOpsPolicy } from "./types.js";
import { canSendContentToAi } from "./policy.js";

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /gh[pousr]_[A-Za-z0-9_]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  /AKIA[0-9A-Z]{16}/g,
];

const ASSIGNMENT_SECRET_PATTERNS = [
  /(api[_-]?key\s*[:=]\s*['"]?)[A-Za-z0-9_\-.]{16,}(['"]?)/gi,
  /(token\s*[:=]\s*['"]?)[A-Za-z0-9_\-.]{16,}(['"]?)/gi
];

export function assertAiContentAllowed(policy: MaintainerOpsPolicy): void {
  if (!canSendContentToAi(policy)) {
    throw new Error("AI content transfer is disabled by policy.");
  }
}

export function redactSensitiveText(input: string): string {
  const directRedacted = SECRET_PATTERNS.reduce((value, pattern) => value.replace(pattern, "[REDACTED]"), input);
  return ASSIGNMENT_SECRET_PATTERNS.reduce(
    (value, pattern) => value.replace(pattern, (_match, prefix: string, suffix: string) => `${prefix}[REDACTED]${suffix}`),
    directRedacted
  );
}
