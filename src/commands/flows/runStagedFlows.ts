import { runnerMessages } from "~/core/messages/index.js";
import { resolveProjectDirSafe } from "~/domains/flows/ensureDeps.js";
import { createAndroidDeps } from "~/domains/runner/runAndroidFlowDeps.js";
import type { flowsRun as defaultFlowsRun } from "~/domains/runner/run.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import type { defaultRunWebFlowDeps } from "~/domains/runner/runWebFlowDeps.js";
import {
  type EnsureRuntimeEnvResult,
  runStagingRoot,
} from "~/domains/runtimeEnv/index.js";
import type {
  PrepareRunDirArgs,
  PrepareRunDirResult,
} from "~/domains/runtimeEnv/prepareRunDir.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import type { ResolveDepsRootArgs } from "~/commands/resolveDepsRoot.js";

import { buildFlowsRunDeps } from "./buildFlowsRunDeps.js";
import type { createFlowRuntimeDeps as defaultCreateFlowRuntimeDeps } from "./flowRuntimeDeps.js";
import { loadEnvFile } from "./loadEnvFile.js";

/** Dependency bundle for the shared post-discovery run-setup phase. */
export type StagedRunDeps = {
  resolveDepsRoot: (
    args: Omit<ResolveDepsRootArgs, "fs">,
  ) => Promise<EnsureRuntimeEnvResult>;
  prepareRunDir: (
    args: Omit<PrepareRunDirArgs, "fs">,
  ) => Promise<PrepareRunDirResult>;
  configureTestkit: (dir: string) => Promise<void>;
  runWebFlowDeps: typeof defaultRunWebFlowDeps;
  createFlowRuntimeDeps: typeof defaultCreateFlowRuntimeDeps;
  flowsRun: typeof defaultFlowsRun;
};

export type RunStagedFlowsArgs = {
  ctx: CommandContext;
  files: string[];
  flags: FlowsRunFlags;
  // .env load dir override; defaults to the resolved project dir or cwd
  envDir?: string;
  deps: StagedRunDeps;
};

/**
 * Shared run-setup for both local and hybrid flow runs. Handles environment
 * resolution, staging, and execution after flow discovery is complete.
 */
export async function runStagedFlows(
  args: RunStagedFlowsArgs,
): Promise<CommandResult> {
  const { ctx, files, flags, envDir, deps } = args;

  ctx.ui.gap();
  ctx.ui.intro("flows run");

  const [runtimeEnv] = await ctx.ui.withProgress(
    [
      {
        message: runnerMessages.preparingEnvironment,
        task: () =>
          deps.resolveDepsRoot({
            files,
            platform: process.platform,
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
  const projectDir = resolveProjectDirSafe(files, ctx.fs);
  await loadEnvFile(envDir ?? projectDir ?? process.cwd());

  const staged = await deps.prepareRunDir({
    files,
    projectDir,
    depsRoot: runtimeEnv.depsRoot,
    runRoot: runStagingRoot(),
    onInstallStart: (depCount) =>
      ctx.ui.info(runnerMessages.installingProjectDeps(depCount)),
  });

  if (staged.outerHop.mode === "install") {
    const log = ctx.log("runner");
    for (const candidate of staged.outerHop.rejected) {
      log.debug(
        runnerMessages.outerHopCandidateRejected(
          candidate.dir,
          candidate.missing,
        ),
      );
    }
  }

  // Register cleanup before the setup calls below so a throw in configureTestkit
  // / runWebFlowDeps never leaks the per-run staging directory.
  const unregisterCleanup = ctx.signals.register(staged.cleanup);
  try {
    const resolvedDir = runtimeEnv.depsRoot;
    await deps.configureTestkit(resolvedDir);
    const android = createAndroidDeps(resolvedDir, ctx.signals);
    const runWebFlowDeps = await deps.runWebFlowDeps(resolvedDir, ctx.signals);
    const flowRuntimeDeps = await deps.createFlowRuntimeDeps({
      envDir: resolvedDir,
      ctx,
    });

    return await deps.flowsRun(
      ctx,
      staged.files,
      flags,
      buildFlowsRunDeps({
        ctx,
        resolvedDir,
        android,
        runWebFlowDeps,
        flowRuntimeDeps,
        flags,
        projectDir,
      }),
    );
  } finally {
    unregisterCleanup();
    await staged.cleanup();
  }
}
