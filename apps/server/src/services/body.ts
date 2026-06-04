export function parseJsonBody(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    const parsed = JSON.parse(body) as unknown;
    if (isRecord(parsed)) return parsed;
    throw new Error("Expected JSON object body.");
  }

  if (isRecord(body)) return body;
  throw new Error("Expected JSON object body.");
}

export function readRawBody(body: unknown): string {
  if (typeof body === "string") return body;
  return JSON.stringify(body ?? {});
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
