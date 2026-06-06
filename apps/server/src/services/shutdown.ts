export interface ShutdownHandlerOptions {
  exit?: (code: number) => void;
  logger?: {
    error: (error: unknown) => void;
  };
}

export function createShutdownHandler(close: () => Promise<void>, options: ShutdownHandlerOptions = {}) {
  const exit = options.exit ?? process.exit;
  let shuttingDown = false;

  return async function shutdown(): Promise<void> {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    try {
      await close();
      exit(0);
    } catch (error) {
      options.logger?.error(error);
      exit(1);
    }
  };
}

export function installShutdownHandlers(close: () => Promise<void>, options: ShutdownHandlerOptions = {}): void {
  const shutdown = createShutdownHandler(close, options);

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
}
