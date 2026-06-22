import { join, resolve } from "node:path";

import { validateEnvId } from "~/domains/flows/pull/pull.js";
import { handleFlowsPull } from "~/domains/flows/pull/handler.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import {
  expandPatterns as defaultExpandPatterns,
  makePeekFlowMeta,
} from "~/domains/flows/expand.js";
import { findFlowStamp as defaultFindFlowStamp } from "~/shell/manifest/lookup.js";
import { installBrowserList } from "~/domains/install/browsers.js";
import { defaultSpawn } from "~/shell/spawn.js";
import { resolvePlaywrightCli } from "~/shell/playwright.js";
import { buildRunReporter } from "./buildRunReporter.js";
import { runAndroidFlow as defaultRunAndroidFlow } from "~/domains/runner/runAndroidFlow.js";
import { runWebFlow as defaultRunWebFlow } from "~/domains/runner/runWebFlow.js";
import { configureTestkit as defaultConfigureTestkit } from "~/shell/testkit.js";
import { ensureRuntimeEnv } from "~/domains/runtimeEnv/index.js";
import type { Fs } from "~/shell/fs.js";
import type { Logger } from "~/shell/logger.js";
import { defaultRunWebFlowDeps } from "~/domains/runner/runWebFlowDeps.js";
import { makePooledDispatch } from "~/domains/runner/makePooledDispatch.js";
import { flowsRun as defaultFlowsRun } from "~/domains/runner/run.js";
import { createAndroidDeps } from "~/domains/runner/runAndroidFlowDeps.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import { buildPatternArgs } from "~/core/patternArgs.js";
import { runnerMessages } from "~/core/messages/index.js";
import { loadEnvFile } from "./loadEnvFile.js";

export type HandleHybridFlowsRunDeps = {
  expandPatterns: (
    patterns: string[],
    cwd: string,
    logger?: Logger,
  ) => Promise<string[]>;
  pullEnv: (ctx: AuthCommandContext, envId: string) => Promise<CommandResult>;
  ensureRuntimeEnv: typeof ensureRuntimeEnv;
  configureTestkit: (dir: string) => Promise<void>;
  flowsRun: typeof defaultFlowsRun;
  runWebFlowDeps: typeof defaultRunWebFlowDeps;
};

function makeDefaultHybridDeps(fs: Fs): HandleHybridFlowsRunDeps {
  return {
    expandPatterns: (patterns, cwd, logger) =>
      defaultExpandPatterns(patterns, cwd, logger, fs),
    pullEnv: (ctx, envId) => handleFlowsPull(ctx, { env: envId, yes: true }),
    ensureRuntimeEnv: (args) => ensureRuntimeEnv(args, { fs }),
    configureTestkit: defaultConfigureTestkit,
    flowsRun: defaultFlowsRun,
    runWebFlowDeps: defaultRunWebFlowDeps,
  };
}

export async function handleHybridFlowsRun(
  ctx: AuthCommandContext,
  pattern: string | undefined,
  flags: FlowsRunFlags & { env: string },
  deps?: HandleHybridFlowsRunDeps,
): Promise<CommandResult> {
  const resolvedDeps = deps ?? makeDefaultHybridDeps(ctx.fs);
  const validation = validateEnvId(flags.env);
  if (validation !== "ok") {
    return { error: validation.error, exitCode: 2 };
  }

  const envDir = resolve(join(".qawolf", flags.env));
  const patternArgs = buildPatternArgs(pattern);

  let files = await resolvedDeps.expandPatterns(
    patternArgs,
    envDir,
    ctx.log("flows"),
  );

  if (files.length === 0) {
    const pullResult = await resolvedDeps.pullEnv(ctx, flags.env);
    if (pullResult !== undefined) return pullResult;

    files = await resolvedDeps.expandPatterns(
      patternArgs,
      envDir,
      ctx.log("flows"),
    );
    if (files.length === 0) {
      return {
        error:
          pattern !== undefined
            ? `No flows matched '${pattern}' in env '${flags.env}'`
            : `No flows found in env '${flags.env}'`,
        exitCode: 2,
      };
    }
  }

  ctx.ui.gap();
  ctx.ui.intro("flows run");

  const [runtimeEnv] = await ctx.ui.withProgress(
    [
      {
        message: runnerMessages.preparingEnvironment,
        task: () =>
          resolvedDeps.ensureRuntimeEnv({
            projectDir: envDir,
            ...(flags.deps !== undefined ? { overrideDir: flags.deps } : {}),
          }),
      },
    ],
    () => runnerMessages.environmentReady,
  );
  if (runtimeEnv.source === "managed") {
    const note = runnerMessages.managedRuntimeNote(runtimeEnv.depsRoot);
    ctx.ui.note(note, "Runtime");
  }
  await loadEnvFile(envDir);
  const resolvedDir = runtimeEnv.depsRoot;
  await resolvedDeps.configureTestkit(resolvedDir);
  const android = createAndroidDeps(resolvedDir, ctx.signals);

  return resolvedDeps.flowsRun(ctx, files, flags, {
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
