import { join, resolve } from "node:path";

import { buildPatternArgs } from "~/core/patternArgs.js";
import { runnerMessages } from "~/core/messages/index.js";
import { resolveProjectDirSafe } from "~/domains/flows/ensureDeps.js";
import { expandPatterns as defaultExpandPatterns } from "~/domains/flows/expand.js";
import { handleFlowsPull } from "~/domains/flows/pull/handler.js";
import { validateEnvId } from "~/domains/flows/pull/pull.js";
import { createAndroidDeps } from "~/domains/runner/runAndroidFlowDeps.js";
import { flowsRun as defaultFlowsRun } from "~/domains/runner/run.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import { defaultRunWebFlowDeps } from "~/domains/runner/runWebFlowDeps.js";
import type { EnsureRuntimeEnvResult } from "~/domains/runtimeEnv/index.js";
import { managedEnvBaseDir } from "~/domains/runtimeEnv/managedEnvDir.js";
import {
  prepareRunDir as defaultPrepareRunDir,
  type PrepareRunDirArgs,
  type PrepareRunDirResult,
} from "~/domains/runtimeEnv/prepareRunDir.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import type { Fs } from "~/shell/fs.js";
import type { Logger } from "~/shell/logger.js";
import { configureTestkit as defaultConfigureTestkit } from "~/shell/testkit.js";
import {
  resolveDepsRoot,
  type ResolveDepsRootArgs,
} from "~/commands/resolveDepsRoot.js";

import { buildFlowsRunDeps } from "./buildFlowsRunDeps.js";
import { loadEnvFile } from "./loadEnvFile.js";

export type HandleHybridFlowsRunDeps = {
  expandPatterns: (
    patterns: string[],
    cwd: string,
    logger?: Logger,
  ) => Promise<string[]>;
  pullEnv: (ctx: AuthCommandContext, envId: string) => Promise<CommandResult>;
  resolveDepsRoot: (
    args: Omit<ResolveDepsRootArgs, "fs">,
  ) => Promise<EnsureRuntimeEnvResult>;
  prepareRunDir: (
    args: Omit<PrepareRunDirArgs, "fs">,
  ) => Promise<PrepareRunDirResult>;
  configureTestkit: (dir: string) => Promise<void>;
  flowsRun: typeof defaultFlowsRun;
  runWebFlowDeps: typeof defaultRunWebFlowDeps;
};

function makeDefaultHybridDeps(fs: Fs): HandleHybridFlowsRunDeps {
  return {
    expandPatterns: (patterns, cwd, logger) =>
      defaultExpandPatterns(patterns, cwd, logger, fs),
    pullEnv: (ctx, envId) => handleFlowsPull(ctx, { env: envId, yes: true }),
    resolveDepsRoot: (args) => resolveDepsRoot({ ...args, fs }),
    prepareRunDir: (args) => defaultPrepareRunDir({ ...args, fs }),
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
  const globFlows = (): Promise<string[]> =>
    resolvedDeps.expandPatterns(patternArgs, envDir, ctx.log("flows"));

  let files = await globFlows();

  if (files.length === 0) {
    const pullResult = await resolvedDeps.pullEnv(ctx, flags.env);
    if (pullResult !== undefined) return pullResult;

    files = await globFlows();
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
          resolvedDeps.resolveDepsRoot({
            files,
            ...(flags.deps !== undefined ? { overrideDir: flags.deps } : {}),
          }),
      },
    ],
    () => runnerMessages.environmentReady,
  );
  if (runtimeEnv.source === "managed") {
    ctx.ui.info(runnerMessages.managedRuntimeNote(runtimeEnv.depsRoot));
  }
  await loadEnvFile(envDir);

  const projectDir = resolveProjectDirSafe(files, ctx.fs);
  const staged = await resolvedDeps.prepareRunDir({
    files,
    projectDir,
    depsRoot: runtimeEnv.depsRoot,
    runRoot: join(managedEnvBaseDir(), ".runs"),
  });

  const resolvedDir = runtimeEnv.depsRoot;
  await resolvedDeps.configureTestkit(resolvedDir);
  const android = createAndroidDeps(resolvedDir, ctx.signals);
  const runWebFlowDeps = await resolvedDeps.runWebFlowDeps(
    resolvedDir,
    ctx.signals,
  );

  const unregisterCleanup = ctx.signals.register(staged.cleanup);
  try {
    return await resolvedDeps.flowsRun(
      ctx,
      staged.files,
      flags,
      buildFlowsRunDeps({ ctx, resolvedDir, android, runWebFlowDeps, flags }),
    );
  } finally {
    unregisterCleanup();
    await staged.cleanup();
  }
}
