import { buildPatternArgs } from "~/core/patternArgs.js";
import { runnerMessages } from "~/core/messages/index.js";
import { pluralize } from "~/core/pluralize.js";
import { expandPatterns as defaultExpandPatterns } from "~/domains/flows/expand.js";
import { flowsRun as defaultFlowsRun } from "~/domains/runner/run.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import { defaultRunWebFlowDeps } from "~/domains/runner/runWebFlowDeps.js";
import { prepareRunDir as defaultPrepareRunDir } from "~/domains/runtimeEnv/prepareRunDir.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import type { Fs } from "~/shell/fs.js";
import type { Logger } from "~/shell/logger.js";
import { configureTestkit as defaultConfigureTestkit } from "~/shell/testkit.js";
import { resolveDepsRoot } from "~/commands/resolveDepsRoot.js";

import { createFlowRuntimeDeps as defaultCreateFlowRuntimeDeps } from "./flowRuntimeDeps.js";
import { type StagedRunDeps, runStagedFlows } from "./runStagedFlows.js";

export type HandleFlowsRunDeps = StagedRunDeps & {
  expandPatterns: (
    patterns: string[],
    cwd: string,
    logger?: Logger,
  ) => Promise<string[]>;
};

function makeDefaultDeps(fs: Fs): HandleFlowsRunDeps {
  return {
    expandPatterns: (patterns, cwd, logger) =>
      defaultExpandPatterns(patterns, cwd, logger, fs),
    resolveDepsRoot: (args) => resolveDepsRoot({ ...args, fs }),
    prepareRunDir: (args) => defaultPrepareRunDir({ ...args, fs }),
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

  return runStagedFlows({
    ctx,
    files: expandedFiles,
    flags,
    deps: resolvedDeps,
  });
}
