import type { AppConfig } from "../config.js";
import { PostgresMaintainerStore } from "./postgres-store.js";
import { InMemoryMaintainerStore, type MaintainerStore } from "./store.js";

export function createMaintainerStore(config: AppConfig): MaintainerStore {
  if (config.storage.driver === "postgres") {
    if (!config.storage.databaseUrl) {
      throw new Error("DATABASE_URL is required when STORE_DRIVER=postgres.");
    }
    return new PostgresMaintainerStore(config.storage.databaseUrl);
  }

  return new InMemoryMaintainerStore();
}
