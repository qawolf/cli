import type { Logger } from "~/shell/logger.js";

/** Returns a Logger that discards all messages. Use in test fixtures. */
export function makeNoopLogger(): Logger {
  return {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    trace: () => {},
  };
}
