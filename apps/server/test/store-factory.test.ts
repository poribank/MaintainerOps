import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { PostgresMaintainerStore } from "../src/services/postgres-store.js";
import { createMaintainerStore } from "../src/services/store-factory.js";
import { InMemoryMaintainerStore } from "../src/services/store.js";

describe("createMaintainerStore", () => {
  it("creates an in-memory store by default", () => {
    const store = createMaintainerStore(loadConfig({ NODE_ENV: "test" }));

    expect(store).toBeInstanceOf(InMemoryMaintainerStore);
  });

  it("requires DATABASE_URL for postgres stores", () => {
    const config = loadConfig({ NODE_ENV: "test", STORE_DRIVER: "postgres" });

    expect(() => createMaintainerStore(config)).toThrow("DATABASE_URL is required");
  });

  it("creates a postgres store when DATABASE_URL is configured", async () => {
    const store = createMaintainerStore(
      loadConfig({
        NODE_ENV: "test",
        STORE_DRIVER: "postgres",
        DATABASE_URL: "postgres://maintainerops:maintainerops@localhost:5432/maintainerops"
      })
    );

    try {
      expect(store).toBeInstanceOf(PostgresMaintainerStore);
    } finally {
      await store.close?.();
    }
  });
});
