import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
} from "~/domains/flows/expand.js";
import { findFlowStamp as defaultFindFlowStamp } from "~/shell/manifest/lookup.js";
import { installBrowserList } from "~/domains/install/browsers.js";
import { defaultSpawn } from "~/shell/spawn.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { isNoEntError } from "~/core/errors.js";
import { buildPatternArgs } from "~/core/patterns.js";
import { resolvePlaywrightCli } from "~/shell/playwright.js";
import { createConsoleReporter } from "~/shell/reporter/createConsoleReporter.js";
import { runAndroidFlow as defaultRunAndroidFlow } from "~/domains/runner/runAndroidFlow.js";
import { runWebFlow as defaultRunWebFlow } from "~/domains/runner/runWebFlow.js";
// import { configureEmails } from "~/emails/configureEmails.js";
import { configureTestkit as defaultConfigureTestkit } from "~/shell/testkit.js";

import { parseDotenv } from "~/domains/flows/dotenv.js";
import {
  ensureFlowDeps as defaultEnsureFlowDeps,
  resolveUniqueEnvDir as defaultResolveUniqueEnvDir,
} from "~/domains/flows/ensureDeps.js";
import { defaultRunWebFlowDeps } from "~/domains/runner/runWebFlowDeps.js";
import { flowsRun as defaultFlowsRun } from "~/domains/runner/run.js";
import { createAndroidDeps } from "~/domains/runner/runAndroidFlowDeps.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";

export async function _loadEnvFile(envDir: string): Promise<void> {
  let content: string;
  try {
    content = await readFile(join(envDir, ".env"), "utf8");
  } catch (err) {
    if (isNoEntError(err)) return;
    throw err;
  }
  const vars = parseDotenv(content);
  for (const [key, value] of Object.entries(vars)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export type HandleFlowsRunDeps = {
  expandPatterns: (patterns: string[], cwd?: string) => Promise<string[]>;
  resolveUniqueEnvDir: (files: string[]) => string | undefined;
  ensureFlowDeps: (envDir: string) => Promise<void>;
  configureTestkit: (dir: string) => Promise<void>;
  runWebFlowDeps: typeof defaultRunWebFlowDeps;
  flowsRun: typeof defaultFlowsRun;
};

function makeDefaultDeps(): HandleFlowsRunDeps {
  return {
    expandPatterns: defaultExpandPatterns,
    resolveUniqueEnvDir: defaultResolveUniqueEnvDir,
    ensureFlowDeps: defaultEnsureFlowDeps,
    configureTestkit: defaultConfigureTestkit,
    runWebFlowDeps: defaultRunWebFlowDeps,
    flowsRun: defaultFlowsRun,
  };
}

export async function handleFlowsRun(
  ctx: CommandContext,
  pattern: string | undefined,
  flags: FlowsRunFlags,
  deps: HandleFlowsRunDeps = makeDefaultDeps(),
): Promise<CommandResult> {
  const cwd = process.cwd();

  const expandedFiles = await deps.expandPatterns(
    buildPatternArgs(pattern),
    cwd,
  );

  let envDir: string | undefined;
  try {
    envDir = deps.resolveUniqueEnvDir(expandedFiles);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { error, exitCode: 2 };
  }

  if (envDir) {
    const dir = envDir;
    await ctx.ui.withProgress(
      [
        {
          message: "Preparing environment",
          task: () => deps.ensureFlowDeps(dir),
        },
      ],
      () => "Environment ready",
    );
    await _loadEnvFile(dir);
  }

  // Resolve playwright from the env dir; falls back to CWD for local flows.
  const resolvedDir = envDir ?? cwd;

  await deps.configureTestkit(resolvedDir);
  const android = createAndroidDeps(resolvedDir);
  return deps.flowsRun(ctx, expandedFiles, flags, {
    peekFlowMeta: defaultPeekFlowMeta,
    installBrowsers: (innerCtx, browsers) =>
      installBrowserList(innerCtx, browsers, {
        spawn: defaultSpawn,
        platform: process.platform,
        playwrightCliPath: resolvePlaywrightCli(resolvedDir),
      }),
    runWebFlow: defaultRunWebFlow,
    runWebFlowDeps: await deps.runWebFlowDeps(resolvedDir),
    runAndroidFlow: defaultRunAndroidFlow,
    runAndroidFlowDeps: android.deps,
    bootAndroid: android.boot,
    shutdownAndroid: android.shutdown,
    findFlowStamp: defaultFindFlowStamp,
    warn: (message) => ctx.ui.warn(message),
    reporter: createConsoleReporter({
      stdout: process.stdout,
      stderr: process.stderr,
    }),
    now: () => Date.now(),
  });
}
