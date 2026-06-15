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
import {
  ensureFlowDeps as defaultEnsureFlowDeps,
  resolveUniqueEnvDir as defaultResolveUniqueEnvDir,
} from "~/domains/flows/ensureDeps.js";
import type { Fs } from "~/shell/fs.js";
import type { Logger } from "~/shell/logger.js";
import { defaultRunWebFlowDeps } from "~/domains/runner/runWebFlowDeps.js";
import { makePooledDispatch } from "~/domains/runner/makePooledDispatch.js";
import { flowsRun as defaultFlowsRun } from "~/domains/runner/run.js";
import { createAndroidDeps } from "~/domains/runner/runAndroidFlowDeps.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";

import { loadEnvFile } from "./loadEnvFile.js";
import { createFlowRuntimeDeps as defaultCreateFlowRuntimeDeps } from "./flowRuntimeDeps.js";

export type HandleFlowsRunDeps = {
  expandPatterns: (
    patterns: string[],
    cwd: string,
    logger?: Logger,
  ) => Promise<string[]>;
  resolveUniqueEnvDir: (files: string[]) => string | undefined;
  ensureFlowDeps: (envDir: string) => Promise<void>;
  configureTestkit: (dir: string) => Promise<void>;
  runWebFlowDeps: typeof defaultRunWebFlowDeps;
  createFlowRuntimeDeps: typeof defaultCreateFlowRuntimeDeps;
  flowsRun: typeof defaultFlowsRun;
};

function makeDefaultDeps(fs: Fs): HandleFlowsRunDeps {
  return {
    expandPatterns: (patterns, cwd, logger) =>
      defaultExpandPatterns(patterns, cwd, logger, fs),
    resolveUniqueEnvDir: (files) => defaultResolveUniqueEnvDir(files, fs),
    ensureFlowDeps: (envDir) => defaultEnsureFlowDeps(envDir, fs),
    configureTestkit: defaultConfigureTestkit,
    runWebFlowDeps: defaultRunWebFlowDeps,
    createFlowRuntimeDeps: defaultCreateFlowRuntimeDeps,
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

  let envDir: string | undefined;
  try {
    envDir = resolvedDeps.resolveUniqueEnvDir(expandedFiles);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { error, exitCode: 2 };
  }

  ctx.ui.gap();
  ctx.ui.intro("flows run");

  if (envDir) {
    const dir = envDir;
    await ctx.ui.withProgress(
      [
        {
          message: runnerMessages.preparingEnvironment,
          task: () => resolvedDeps.ensureFlowDeps(dir),
        },
      ],
      () => runnerMessages.environmentReady,
    );
    await loadEnvFile(dir);
  }

  // Resolve playwright from the env dir; falls back to CWD for local flows.
  const resolvedDir = envDir ?? cwd;

  await resolvedDeps.configureTestkit(resolvedDir);
  const flowRuntimeDeps = resolvedDeps.createFlowRuntimeDeps({
    envDir: resolvedDir,
    ctx,
  });
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
    runWebFlowDeps: {
      ...(await resolvedDeps.runWebFlowDeps(resolvedDir, ctx.signals)),
      flowRuntimeDeps,
    },
    runAndroidFlow: defaultRunAndroidFlow,
    runAndroidFlowDeps: { ...android.deps, flowRuntimeDeps },
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
