import { join } from "node:path";

import { buildPatternArgs } from "~/core/patternArgs.js";
import { runnerMessages } from "~/core/messages/index.js";
import { pluralize } from "~/core/pluralize.js";
import { resolveProjectDirSafe } from "~/domains/flows/ensureDeps.js";
import { expandPatterns as defaultExpandPatterns } from "~/domains/flows/expand.js";
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
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import type { Fs } from "~/shell/fs.js";
import type { Logger } from "~/shell/logger.js";
import { configureTestkit as defaultConfigureTestkit } from "~/shell/testkit.js";
import {
  resolveDepsRoot,
  type ResolveDepsRootArgs,
} from "~/commands/resolveDepsRoot.js";

import { buildFlowsRunDeps } from "./buildFlowsRunDeps.js";
import { loadEnvFile } from "./loadEnvFile.js";

export type HandleFlowsRunDeps = {
  expandPatterns: (
    patterns: string[],
    cwd: string,
    logger?: Logger,
  ) => Promise<string[]>;
  resolveDepsRoot: (
    args: Omit<ResolveDepsRootArgs, "fs">,
  ) => Promise<EnsureRuntimeEnvResult>;
  prepareRunDir: (
    args: Omit<PrepareRunDirArgs, "fs">,
  ) => Promise<PrepareRunDirResult>;
  configureTestkit: (dir: string) => Promise<void>;
  runWebFlowDeps: typeof defaultRunWebFlowDeps;
  flowsRun: typeof defaultFlowsRun;
};

function makeDefaultDeps(fs: Fs): HandleFlowsRunDeps {
  return {
    expandPatterns: (patterns, cwd, logger) =>
      defaultExpandPatterns(patterns, cwd, logger, fs),
    resolveDepsRoot: (args) => resolveDepsRoot({ ...args, fs }),
    prepareRunDir: (args) => defaultPrepareRunDir({ ...args, fs }),
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

  ctx.ui.gap();
  ctx.ui.intro("flows run");

  const [runtimeEnv] = await ctx.ui.withProgress(
    [
      {
        message: runnerMessages.preparingEnvironment,
        task: () =>
          resolvedDeps.resolveDepsRoot({
            files: expandedFiles,
            ...(flags.deps !== undefined ? { overrideDir: flags.deps } : {}),
          }),
      },
    ],
    () => runnerMessages.environmentReady,
  );

  if (runtimeEnv.source === "managed") {
    ctx.ui.info(runnerMessages.managedRuntimeNote(runtimeEnv.depsRoot));
  }

  // Load the user's project .env from the project dir (NOT the deps dir).
  const projectDir = resolveProjectDirSafe(expandedFiles, ctx.fs);
  await loadEnvFile(projectDir ?? cwd);

  const staged = await resolvedDeps.prepareRunDir({
    files: expandedFiles,
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
