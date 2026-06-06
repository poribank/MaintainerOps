import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schemaPath = path.resolve(process.cwd(), "db/schema.sql");

describe("Postgres schema", () => {
  it("constrains persisted work item and audit enum values", async () => {
    const schema = await readFile(schemaPath, "utf8");

    expect(schema).toContain("kind TEXT NOT NULL CHECK (kind IN ('pull_request', 'issue', 'release', 'security', 'policy'))");
    expect(schema).toContain("status TEXT NOT NULL CHECK (status IN ('open', 'triaged', 'snoozed', 'resolved'))");
    expect(schema).toContain(
      "outcome TEXT NOT NULL CHECK (outcome IN ('approved', 'rejected', 'applied', 'failed', 'recorded'))"
    );
  });
});
