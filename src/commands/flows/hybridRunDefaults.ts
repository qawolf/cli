import { join, resolve } from "node:path";

import { buildPatternArgs } from "~/core/patternArgs.js";
import type { EnvironmentIdentity } from "~/core/environmentIdentity.js";
import { runnerMessages } from "~/core/messages/index.js";
import { expandPatterns as defaultExpandPatterns } from "~/domains/flows/expand.js";
import { handleFlowsPull } from "~/domains/flows/pull/handler.js";
import { validateEnvId } from "~/domains/flows/pull/pull.js";
import { flowsRun as defaultFlowsRun } from "~/domains/runner/run.js";
import { noMatchResult } from "~/domains/runner/noMatch.js";
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
  pullEnv: (
    ctx: AuthCommandContext,
    envId: string,
    identity: EnvironmentIdentity,
  ) => Promise<CommandResult>;
};

function makeDefaultHybridDeps(fs: Fs): HandleHybridFlowsRunDeps {
  return {
    expandPatterns: (patterns, cwd, logger) =>
      defaultExpandPatterns(patterns, cwd, logger, fs),
    pullEnv: (ctx, envId, identity) =>
      handleFlowsPull(ctx, {
        env: envId,
        yes: true,
        envSlug: identity.slug,
        envName: identity.name,
      }),
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
  identity: EnvironmentIdentity = { slug: undefined, name: undefined },
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
    const pullResult = await resolvedDeps.pullEnv(ctx, flags.env, identity);
    if (pullResult !== undefined) return pullResult;

    files = await globFlows();
    if (files.length === 0) {
      return noMatchResult(ctx, {
        allowNoMatch: flags.allowNoMatch,
        error: runnerMessages.noFlowsMatchedInEnv(flags.env, pattern),
        notice: runnerMessages.noFlowsMatched,
      });
    }
  }

  return runStagedFlows({ ctx, files, flags, envDir, deps: resolvedDeps });
}
