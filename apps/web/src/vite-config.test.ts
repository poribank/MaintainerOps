import { describe, expect, it } from "vitest";
import config from "../vite.config.js";

describe("dashboard Vite config", () => {
  it("keeps the documented dev server port stable", () => {
    expect(config.server?.port).toBe(5173);
    expect(config.server?.strictPort).toBe(true);
  });

  it("proxies API and readiness requests to the local server", () => {
    expect(config.server?.proxy).toMatchObject({
      "/api": "http://localhost:3000",
      "/healthz": "http://localhost:3000",
      "/readyz": "http://localhost:3000"
    });
  });
});
