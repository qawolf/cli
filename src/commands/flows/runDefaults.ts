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

import { ensureFlowDeps, resolveUniqueEnvDir } from "./ensureDeps.js";
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
  let playwright: Pick<RunWebFlowDeps, "chromium" | "firefox" | "webkit">;
  try {
    playwright = createRequire(join(cwd, "package.json"))("playwright") as Pick<
      RunWebFlowDeps,
      "chromium" | "firefox" | "webkit"
    >;
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

  // Pre-expand to find the env directory so we can install its deps and
  // resolve playwright from there. The expansion runs again inside flowsRun.
  const expandedFiles = await defaultExpandPatterns(
    pattern ? [pattern] : [],
    cwd,
  );

  let envDir: string | undefined;
  try {
    envDir = resolveUniqueEnvDir(expandedFiles);
  } catch (err) {
    return { error: (err as Error).message, exitCode: 2 };
  }

  if (envDir) {
    await ctx.ui.withProgress(
      [
        {
          message: "Preparing environment",
          task: () => ensureFlowDeps(envDir),
        },
      ],
      () => "Environment ready",
    );
  }

  // Resolve playwright from the env dir (where it was just installed).
  // Falls back to CWD if no env dir was detected (e.g. running local flows).
  const resolvedDir = envDir ?? cwd;

  return flowsRun(ctx, pattern, flags, {
    cwd,
    expandPatterns: defaultExpandPatterns,
    peekFlowMeta: defaultPeekFlowMeta,
    installBrowsers: (innerCtx, browsers) =>
      installBrowserList(innerCtx, browsers, {
        spawn: defaultSpawn,
        platform: process.platform,
        execPath: process.execPath,
        playwrightCliPath: resolvePlaywrightCli(resolvedDir),
      }),
    runWebFlow: defaultRunWebFlow,
    runWebFlowDeps: defaultRunWebFlowDeps(resolvedDir),
    reporter: createConsoleReporter({
      stdout: process.stdout,
      stderr: process.stderr,
    }),
    now: () => Date.now(),
  });
}
