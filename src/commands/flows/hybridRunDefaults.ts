import { join, resolve } from "node:path";

import { buildPatternArgs } from "~/core/patternArgs.js";
import { runnerMessages } from "~/core/messages/index.js";
import { expandPatterns as defaultExpandPatterns } from "~/domains/flows/expand.js";
import { handleFlowsPull } from "~/domains/flows/pull/handler.js";
import { validateEnvId } from "~/domains/flows/pull/pull.js";
import { flowsRun as defaultFlowsRun } from "~/domains/runner/run.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import { defaultRunWebFlowDeps } from "~/domains/runner/runWebFlowDeps.js";
import { prepareRunDir as defaultPrepareRunDir } from "~/domains/runtimeEnv/prepareRunDir.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import type { Fs } from "~/shell/fs.js";
import { configureTestkit as defaultConfigureTestkit } from "~/shell/testkit.js";
import { resolveDepsRoot } from "~/commands/resolveDepsRoot.js";
import { createFlowRuntimeDeps as defaultCreateFlowRuntimeDeps } from "./flowRuntimeDeps.js";

import { type HandleFlowsRunDeps } from "./runDefaults.js";
import { runStagedFlows } from "./runStagedFlows.js";

export type HandleHybridFlowsRunDeps = HandleFlowsRunDeps & {
  pullEnv: (ctx: AuthCommandContext, envId: string) => Promise<CommandResult>;
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
    createFlowRuntimeDeps: defaultCreateFlowRuntimeDeps,
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
      if (flags.allowNoMatch) {
        ctx.ui.info(runnerMessages.noFlowsMatched);
        return;
      }
      return {
        error:
          pattern !== undefined
            ? `No flows matched '${pattern}' in env '${flags.env}'`
            : `No flows found in env '${flags.env}'`,
        exitCode: 2,
      };
    }
  }

  return runStagedFlows({ ctx, files, flags, envDir, deps: resolvedDeps });
}
