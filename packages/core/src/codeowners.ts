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

    const [pattern] = line.split(/\s+/);
    if (!pattern) {
      return;
    }

    const owners = readOwners(tokensAfterPattern(rawLine));
    let valid = true;

    if (pattern.startsWith("!")) {
      valid = false;
      errors.push({
        line: lineNumber,
        kind: "unsupported_negation",
        message: "CODEOWNERS does not support negation patterns."
      });
    }

    for (const owner of owners) {
      if (!OWNER_PATTERN.test(owner)) {
        valid = false;
        errors.push({
          line: lineNumber,
          kind: "invalid_owner",
          message: `Invalid owner '${owner}'.`
        });
      }
    }

    if (valid) {
      entries.push({ pattern, owners, line: lineNumber });
    }
  });

  return { entries, errors };
}

export function findUnownedFiles(files: string[], entries: CodeownersEntry[]): string[] {
  return files.filter((file) => {
    const ownerEntry = entries.filter((entry) => matchesCodeownersPattern(entry.pattern, file)).at(-1);
    return !ownerEntry || ownerEntry.owners.length === 0;
  });
}

export function matchesCodeownersPattern(pattern: string, path: string): boolean {
  const anchored = pattern.startsWith("/");
  const normalizedPattern = pattern.replace(/^\//, "");
  const normalizedPath = path.replace(/^\//, "");

  if (normalizedPattern === "*") {
    return true;
  }

  if (normalizedPattern.endsWith("/")) {
    return matchesDirectoryPattern(normalizedPattern.slice(0, -1), normalizedPath, anchored);
  }

  if (normalizedPattern.startsWith("**/") && !normalizedPattern.slice(3).includes("*")) {
    return matchesDirectoryPattern(normalizedPattern.slice(3), normalizedPath, false);
  }

  if (!normalizedPattern.includes("/")) {
    const regex = globSegmentRegExp(normalizedPattern);
    return normalizedPath.split("/").some((segment) => regex.test(segment));
  }

  if (!normalizedPattern.includes("*")) {
    return matchesDirectoryPattern(normalizedPattern, normalizedPath, anchored);
  }

  return globPathRegExp(normalizedPattern).test(normalizedPath);
}

function tokensAfterPattern(line: string): string[] {
  return line.trim().split(/\s+/).slice(1);
}

function readOwners(tokens: string[]): string[] {
  const commentIndex = tokens.findIndex((token) => token.startsWith("#"));
  return commentIndex === -1 ? tokens : tokens.slice(0, commentIndex);
}

function matchesDirectoryPattern(pattern: string, path: string, anchored: boolean): boolean {
  const normalizedPattern = pattern.startsWith("**/") ? pattern.slice(3) : pattern;
  const exactOrDescendant = path === normalizedPattern || path.startsWith(`${normalizedPattern}/`);
  if (anchored) return exactOrDescendant;
  return exactOrDescendant || path.includes(`/${normalizedPattern}/`);
}

function globSegmentRegExp(pattern: string): RegExp {
  return new RegExp(`^${globToRegExpSource(pattern, false)}$`);
}

function globPathRegExp(pattern: string): RegExp {
  return new RegExp(`^${globToRegExpSource(pattern, true)}$`);
}

function globToRegExpSource(pattern: string, allowSlash: boolean): string {
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern.charAt(index);
    if (char === "*") {
      if (pattern.charAt(index + 1) === "*") {
        source += ".*";
        index += 1;
      } else {
        source += allowSlash ? "[^/]*" : ".*";
      }
      continue;
    }
    source += escapeRegExp(char);
  }
  return source;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
