import { AsyncLocalStorage } from "node:async_hooks";
import { makeDefaultFs } from "~/shell/fs.js";
import type { RunnerDeps } from "./types.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

export function createRunnerDeps(
  signals: SignalRegistry,
  depsRoot: string,
): RunnerDeps {
  return {
    fs: makeDefaultFs(),
    signals,
    depsRoot,
    createStorage: <T>() => {
      // Stored as `unknown` internally; the getStore cast keeps the outer T
      // contract while sidestepping TS's inability to unify the outer T with
      // AsyncLocalStorage's instance method generic.
      const als = new AsyncLocalStorage<unknown>();
      return {
        run: async (store: T, callback) => {
          await als.run(store, callback);
        },
        getStore: () => als.getStore() as T | undefined,
      };
    },
  };
}
