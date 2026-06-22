import {
  expandPatterns as defaultExpandPatterns,
  makePeekFlowMeta,
} from "~/domains/flows/expand.js";
import { findFlowStamp as defaultFindFlowStamp } from "~/shell/manifest/lookup.js";
import { installBrowserList } from "~/domains/install/browsers.js";
import { defaultSpawn } from "~/shell/spawn.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { buildPatternArgs } from "~/core/patternArgs.js";
import { runnerMessages } from "~/core/messages/index.js";
import { resolvePlaywrightCli } from "~/shell/playwright.js";
import { buildRunReporter } from "./buildRunReporter.js";
import { runAndroidFlow as defaultRunAndroidFlow } from "~/domains/runner/runAndroidFlow.js";
import { runWebFlow as defaultRunWebFlow } from "~/domains/runner/runWebFlow.js";
import { configureTestkit as defaultConfigureTestkit } from "~/shell/testkit.js";

import { pluralize } from "~/core/pluralize.js";
import { resolveUniqueEnvDir as defaultResolveUniqueEnvDir } from "~/domains/flows/ensureDeps.js";
import {
  ensureRuntimeEnv,
  type EnsureRuntimeEnvArgs,
  type EnsureRuntimeEnvResult,
} from "~/domains/runtimeEnv/index.js";
import type { Fs } from "~/shell/fs.js";
import type { Logger } from "~/shell/logger.js";
import { defaultRunWebFlowDeps } from "~/domains/runner/runWebFlowDeps.js";
import { makePooledDispatch } from "~/domains/runner/makePooledDispatch.js";
import { flowsRun as defaultFlowsRun } from "~/domains/runner/run.js";
import { createAndroidDeps } from "~/domains/runner/runAndroidFlowDeps.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";

import { loadEnvFile } from "./loadEnvFile.js";

export type HandleFlowsRunDeps = {
  expandPatterns: (
    patterns: string[],
    cwd: string,
    logger?: Logger,
  ) => Promise<string[]>;
  resolveUniqueEnvDir: (files: string[]) => string | undefined;
  ensureRuntimeEnv: (
    args: EnsureRuntimeEnvArgs,
  ) => Promise<EnsureRuntimeEnvResult>;
  configureTestkit: (dir: string) => Promise<void>;
  runWebFlowDeps: typeof defaultRunWebFlowDeps;
  flowsRun: typeof defaultFlowsRun;
};

function makeDefaultDeps(fs: Fs): HandleFlowsRunDeps {
  return {
    expandPatterns: (patterns, cwd, logger) =>
      defaultExpandPatterns(patterns, cwd, logger, fs),
    resolveUniqueEnvDir: (files) => defaultResolveUniqueEnvDir(files, fs),
    ensureRuntimeEnv: (args) => ensureRuntimeEnv(args, { fs }),
    configureTestkit: defaultConfigureTestkit,
    runWebFlowDeps: defaultRunWebFlowDeps,
    flowsRun: defaultFlowsRun,
  };
}

export async function handleFlowsRun(
  ctx: CommandContext,
  pattern: string | undefined,
  flags: FlowsRunFlags,
  deps?: HandleFlowsRunDeps,
): Promise<CommandResult> {
  const resolvedDeps = deps ?? makeDefaultDeps(ctx.fs);
  const cwd = process.cwd();

  const expandedFiles = await resolvedDeps.expandPatterns(
    buildPatternArgs(pattern),
    cwd,
    ctx.log("flows"),
  );
  ctx
    .log("flows")
    .debug(`discovered ${pluralize(expandedFiles.length, "flow")}`);

  if (expandedFiles.length === 0) {
    ctx.ui.info(runnerMessages.noFlowsMatched);
    return;
  }

  let projectDir: string | undefined;
  try {
    projectDir = resolvedDeps.resolveUniqueEnvDir(expandedFiles);
  } catch {
    // Flows span multiple packages — fall back to the managed runtime dir.
    projectDir = undefined;
  }

  ctx.ui.gap();
  ctx.ui.intro("flows run");

  const [runtimeEnv] = await ctx.ui.withProgress(
    [
      {
        message: runnerMessages.preparingEnvironment,
        task: () =>
          resolvedDeps.ensureRuntimeEnv({
            ...(projectDir !== undefined ? { projectDir } : {}),
            ...(flags.deps !== undefined ? { overrideDir: flags.deps } : {}),
          }),
      },
    ],
    () => runnerMessages.environmentReady,
  );

  if (runtimeEnv.source === "managed") {
    ctx.ui.note(
      runnerMessages.managedRuntimeNote(runtimeEnv.depsRoot),
      "Runtime",
    );
  }

  // Load the user's project .env from the project dir (NOT the deps dir).
  await loadEnvFile(projectDir ?? cwd);

  const resolvedDir = runtimeEnv.depsRoot;

  await resolvedDeps.configureTestkit(resolvedDir);
  const android = createAndroidDeps(resolvedDir, ctx.signals);
  return resolvedDeps.flowsRun(ctx, expandedFiles, flags, {
    peekFlowMeta: makePeekFlowMeta(ctx.fs),
    installBrowsers: (innerCtx, browsers) =>
      installBrowserList(innerCtx, browsers, {
        spawn: defaultSpawn,
        platform: process.platform,
        playwrightCliPath: resolvePlaywrightCli(resolvedDir, process.platform),
      }),
    runWebFlow: defaultRunWebFlow,
    runWebFlowDeps: await resolvedDeps.runWebFlowDeps(resolvedDir, ctx.signals),
    runAndroidFlow: defaultRunAndroidFlow,
    runAndroidFlowDeps: android.deps,
    bootAndroid: android.boot,
    shutdownAndroid: android.shutdown,
    createPooledDispatch: makePooledDispatch(resolvedDir),
    findFlowStamp: defaultFindFlowStamp,
    warn: (message) => ctx.ui.warn(message),
    logger: ctx.log("runner"),
    // Route reporter output through ctx.ui so streamed test logs stay inside the run's timeline.
    reporter: buildRunReporter(flags, {
      fs: ctx.fs,
      stdout: { write: (text: string) => ctx.ui.write(text) },
      stderr: { write: (text: string) => ctx.ui.write(text) },
    }),
    now: () => Date.now(),
  });
}
