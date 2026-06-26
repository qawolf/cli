import { AsyncLocalStorage } from "node:async_hooks";
import { makeDefaultFs } from "~/shell/fs.js";
import { spawn as nodeSpawn } from "~/shell/spawn.js";
import type { RunnerDeps } from "./types.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

export function createRunnerDeps(
  signals: SignalRegistry,
  depsRoot: string,
): RunnerDeps {
  return {
    fs: makeDefaultFs(),
    spawn: (cmd, args) => {
      const child = nodeSpawn(cmd, args);
      const exitCode = new Promise<number>((resolve) => {
        // ENOENT (missing binary) fires `error`, not `close` — without a
        // listener the event would be unhandled and crash the process.
        child.on("error", () => resolve(-1));
        child.on("close", (code) => resolve(code ?? -1));
      });
      return {
        exitCode,
        kill: () => {
          child.kill();
        },
      };
    },
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
