import { AsyncLocalStorage } from "node:async_hooks";
import { spawn as nodeSpawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

import {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
} from "~/commands/flows/expand.js";
import { installBrowserList } from "~/commands/install/browsers.js";
import { defaultSpawn } from "~/lib/spawn.js";
import type { CommandContext, CommandResult } from "~/lib/context.js";
import { resolvePlaywrightCli } from "~/lib/playwright.js";
import { createConsoleReporter } from "~/lib/reporter/createConsoleReporter.js";
import {
  type RunWebFlowDeps,
  runWebFlow as defaultRunWebFlow,
} from "~/lib/runner/runWebFlow.js";

import { flowsRun } from "./run.js";
import type { FlowsRunFlags } from "./runInternals.js";

function defaultRunWebFlowDeps(cwd = process.cwd()): RunWebFlowDeps {
  // Resolved via createRequire so bun's --compile bundler does not trace the
  // import statically. playwright-core has optional deps (electron,
  // chromium-bidi) that are not installed and would break the binary build.
  // Resolved from cwd so the project's playwright is used, not the CLI's.
  // Playwright's BrowserType is structurally close to BrowserDep but its
  // newContext() returns Page[].video() = Video | null while MinimalPage
  // expects MinimalVideo | undefined. Runtime values are interchangeable
  // (the runner only reads .path() / .delete() on the video).
  let chromium: RunWebFlowDeps["chromium"];
  let firefox: RunWebFlowDeps["firefox"];
  let webkit: RunWebFlowDeps["webkit"];
  try {
    ({ chromium, firefox, webkit } = createRequire(join(cwd, "package.json"))(
      "playwright",
    ) as Pick<RunWebFlowDeps, "chromium" | "firefox" | "webkit">);
  } catch {
    // rethrow with a clear message so users know what to install
    throw new Error(
      "Playwright is not installed in your project. Run `npm install playwright` or `bun add playwright`.",
    );
  }
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
    signals: {
      on: (signal, handler) => {
        process.on(signal, handler);
        return () => {
          process.off(signal, handler);
        };
      },
    },
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

export async function handleFlowsRun(
  ctx: CommandContext,
  pattern: string | undefined,
  flags: FlowsRunFlags,
): Promise<CommandResult> {
  const cwd = process.cwd();
  return flowsRun(ctx, pattern, flags, {
    cwd,
    expandPatterns: defaultExpandPatterns,
    peekFlowMeta: defaultPeekFlowMeta,
    installBrowsers: (innerCtx, browsers) =>
      installBrowserList(innerCtx, browsers, {
        spawn: defaultSpawn,
        platform: process.platform,
        execPath: process.execPath,
        playwrightCliPath: resolvePlaywrightCli(cwd),
      }),
    runWebFlow: defaultRunWebFlow,
    runWebFlowDeps: defaultRunWebFlowDeps(cwd),
    reporter: createConsoleReporter({
      stdout: process.stdout,
      stderr: process.stderr,
    }),
    now: () => Date.now(),
  });
}
