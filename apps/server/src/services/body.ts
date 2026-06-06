import { Buffer } from "node:buffer";

export function parseJsonBody(body: unknown): Record<string, unknown> {
  if (Buffer.isBuffer(body)) {
    return parseJsonBody(body.toString("utf8"));
  }

  if (typeof body === "string") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body) as unknown;
    } catch {
      throw new BadRequestBodyError("Request body must be valid JSON.");
    }
    if (isRecord(parsed)) return parsed;
    throw new BadRequestBodyError("Request body must be a JSON object.");
  }

  if (isRecord(body)) return body;
  throw new BadRequestBodyError("Request body must be a JSON object.");
}

export function readRawBody(body: unknown): string {
  if (typeof body === "string") return body;
  if (Buffer.isBuffer(body)) return body.toString("utf8");
  return JSON.stringify(body ?? {});
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class BadRequestBodyError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "BadRequestBodyError";
  }
}
