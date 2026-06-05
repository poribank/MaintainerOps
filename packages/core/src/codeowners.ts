export interface CodeownersEntry {
  pattern: string;
  owners: string[];
  line: number;
}

export interface CodeownersError {
  line: number;
  kind: "missing_owner" | "invalid_owner" | "unsupported_negation";
  message: string;
}

export interface CodeownersParseResult {
  entries: CodeownersEntry[];
  errors: CodeownersError[];
}

const OWNER_PATTERN = /^(@[A-Za-z0-9-]+(?:\/[A-Za-z0-9_.-]+)?|[^\s@]+@[^\s@]+\.[^\s@]+)$/;

export function parseCodeowners(source: string): CodeownersParseResult {
  const entries: CodeownersEntry[] = [];
  const errors: CodeownersError[] = [];
  const lines = source.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      return;
    }

    const [pattern, ...owners] = line.split(/\s+/);
    if (!pattern) {
      return;
    }

    if (pattern.startsWith("!")) {
      errors.push({
        line: lineNumber,
        kind: "unsupported_negation",
        message: "CODEOWNERS does not support negation patterns."
      });
    }

    if (owners.length === 0) {
      errors.push({
        line: lineNumber,
        kind: "missing_owner",
        message: "CODEOWNERS entry has no owner."
      });
    }

    for (const owner of owners) {
      if (!OWNER_PATTERN.test(owner)) {
        errors.push({
          line: lineNumber,
          kind: "invalid_owner",
          message: `Invalid owner '${owner}'.`
        });
      }
    }

    entries.push({ pattern, owners, line: lineNumber });
  });

  return { entries, errors };
}

export function findUnownedFiles(files: string[], entries: CodeownersEntry[]): string[] {
  return files.filter(
    (file) =>
      !entries.some((entry) => hasValidOwner(entry) && matchesCodeownersPattern(entry.pattern, file))
  );
}

export function matchesCodeownersPattern(pattern: string, path: string): boolean {
  const normalizedPattern = pattern.replace(/^\//, "");
  const normalizedPath = path.replace(/^\//, "");

  if (normalizedPattern === "*") {
    return true;
  }

  if (normalizedPattern.endsWith("/")) {
    return normalizedPath.startsWith(normalizedPattern);
  }

  const regex = new RegExp(
    `^${escapeRegExp(normalizedPattern)
      .replace(/\\\*\\\*/g, ".*")
      .replace(/\\\*/g, "[^/]*")}$`
  );
  return regex.test(normalizedPath) || normalizedPath.endsWith(`/${normalizedPattern}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasValidOwner(entry: CodeownersEntry): boolean {
  return entry.owners.some((owner) => OWNER_PATTERN.test(owner));
}
