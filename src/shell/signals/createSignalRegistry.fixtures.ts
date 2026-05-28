import type { SignalRegistry } from "./createSignalRegistry.js";

export function makeNoopSignals(): SignalRegistry {
  return {
    register: () => () => {},
    shutdown: async () => {},
  };
}
