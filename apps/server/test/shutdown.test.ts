import { describe, expect, it } from "vitest";
import { createShutdownHandler } from "../src/services/shutdown.js";

describe("createShutdownHandler", () => {
  it("closes once even when invoked repeatedly", async () => {
    let closeCalls = 0;
    const exits: number[] = [];
    const shutdown = createShutdownHandler(
      async () => {
        closeCalls += 1;
      },
      { exit: (code) => exits.push(code) }
    );

    await Promise.all([shutdown(), shutdown(), shutdown()]);

    expect(closeCalls).toBe(1);
    expect(exits).toEqual([0]);
  });

  it("exits with a failure code when close fails", async () => {
    const errors: unknown[] = [];
    const exits: number[] = [];
    const shutdown = createShutdownHandler(
      async () => {
        throw new Error("close failed");
      },
      { exit: (code) => exits.push(code), logger: { error: (error) => errors.push(error) } }
    );

    await shutdown();

    expect(exits).toEqual([1]);
    expect(errors[0]).toBeInstanceOf(Error);
  });
});
