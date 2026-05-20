import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, unlink, writeFile } from "~/shell/fs.js";
import { spawn as nodeSpawn } from "~/shell/spawn.js";
import { pathToFileURL } from "node:url";

import type { RunWebFlowDeps } from "./runWebFlow.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

const noopSignals: SignalRegistry = {
  register: () => () => {},
  shutdown: async () => {},
};

export async function defaultRunWebFlowDeps(
  cwd = process.cwd(),
  signals: SignalRegistry = noopSignals,
): Promise<RunWebFlowDeps> {
  // Loaded via import.meta.resolve so the binary finds playwright in the
  // project's node_modules rather than alongside the CLI binary. Dynamic
  // import() also prevents bun's --compile bundler from tracing playwright-core
  // statically — it has optional deps (electron, chromium-bidi) that are not
  // installed and would break the binary build if bundled.
  // Playwright's BrowserType is structurally close to BrowserDep but its
  // newContext() returns Page[].video() = Video | null while MinimalPage
  // expects MinimalVideo | undefined. Runtime values are interchangeable
  // (the runner only reads .path() / .delete() on the video).
  let playwright: Pick<RunWebFlowDeps, "chromium" | "firefox" | "webkit">;
  try {
    playwright = (await import(
      import.meta.resolve("playwright", pathToFileURL(cwd))
    )) as Pick<RunWebFlowDeps, "chromium" | "firefox" | "webkit">;
  } catch (err) {
    throw new Error(
      "Could not load Playwright. Install it in your project: `npm install playwright` or `bun add playwright`.",
      { cause: err },
    );
  }
  const { chromium, firefox, webkit } = playwright;
  return {
    chromium,
    firefox,
    webkit,
    fs: {
      mkdir: async (p, opts) => {
        await mkdir(p, opts);
      },
      writeFile: async (p, d) => {
        await writeFile(p, d);
      },
      unlink: async (p) => {
        await unlink(p);
      },
    },
    spawn: (cmd, args) => {
      const child = nodeSpawn(cmd, args);
      return {
        exitCode: new Promise((resolve) =>
          child.on("close", (code) => resolve(code ?? -1)),
        ),
        kill: () => {
          child.kill();
        },
      };
    },
    signals,
    createStorage: <T>() => {
      // Stored as `unknown` internally; casts on the boundary keep the outer T
      // contract while sidestepping TS's inability to unify the outer T with
      // AsyncLocalStorage's instance method generic.
      const als = new AsyncLocalStorage<unknown>();
      return {
        run: async (store, callback) => {
          await als.run(store, callback);
        },
        getStore: () => als.getStore() as T | undefined,
      };
    },
  };
}
