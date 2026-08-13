import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { parseFollowTimeout } from "~/core/interactiveRunner/followTimeout.js";
import {
  checkRunFiles,
  describeRunFilesCheck,
  toCollectedPath,
} from "~/core/interactiveRunner/runFiles.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import { collectRunFiles } from "./collectFiles.js";
import type { InteractiveRunnerDeps } from "./deps.js";
import { resolveRecorderAnchor } from "./followPrinters.js";
import { followRun } from "./followRun.js";
import { announceRunner, resolveRunner } from "./resolveRunner.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

export async function handleRunnerRun(
  ctx: AuthCommandContext,
  options: {
    entryPoint: string;
    follow: boolean;
    logs: boolean;
    recorderEvents: boolean;
    runEvents: boolean;
    runner: string | undefined;
    timeout: string | undefined;
  },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const timeout = parseFollowTimeout(options.timeout);
  if (!timeout.ok) {
    return { error: timeout.error, exitCode: exitCodes.invalidArgs };
  }

  // Before the runner, not after: collecting and checking the files costs
  // nothing and resolving a runner may launch and bill one. A misspelled flow
  // name should not be answered with a pod.
  const entryPointPath = toCollectedPath(deps.cwd, options.entryPoint);
  const collected = await collectRunFiles(deps);
  if (!collected.ok) {
    return { error: collected.error, exitCode: exitCodes.config };
  }
  const files = collected.files;
  const check = checkRunFiles(files, entryPointPath);
  if (check.type !== "ok") {
    return {
      error: describeRunFilesCheck(check),
      exitCode: exitCodes.invalidArgs,
    };
  }

  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: true, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed") {
    return { ...failureFields(resolved), exitCode: resolved.exitCode };
  }
  announceRunner(ctx, resolved);

  let recorderSinceSequence: number | undefined;
  if (options.recorderEvents) {
    const anchor = await resolveRecorderAnchor(ctx, resolved, deps);
    if (!anchor.ok) return { ...anchor.failure };
    recorderSinceSequence = anchor.sinceSequence;
  }

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.runFlow,
    { entryPointPath, files, id: resolved.runnerId },
    runnerCallOptions,
  );
  if (!result.ok) {
    return { ...failureFields(result), exitCode: exitCodes.network };
  }

  switch (result.value.outcome) {
    case "runner-target-mismatch":
      return {
        error: interactiveRunnerMessages.targetMismatch(
          result.value.runnerName,
          result.value.requiredRunnerName,
        ),
        exitCode: exitCodes.invalidArgs,
      };
    case "runner-unreachable":
      // Never a retry suggestion: the run may have started and been too slow to
      // say so, and running the flow again would bill a second one.
      return {
        error: interactiveRunnerMessages.submitMayHaveStarted,
        exitCode: exitCodes.network,
      };
    case "submitted": {
      const runId = result.value.runId;
      // The stream flags imply --follow: each only chooses what a follow
      // prints, so alone it can only mean "follow, with that stream".
      const follow =
        options.follow ||
        options.logs ||
        options.runEvents ||
        options.recorderEvents;
      if (!follow) {
        ctx.ui.output(
          { runId, runnerId: resolved.runnerId },
          interactiveRunnerMessages.runSubmitted(runId),
        );
        return undefined;
      }
      // A diagnostic while following, not the command's output: what stdout
      // carries then is the run's journal entries, and a differently shaped
      // object among them leaves a reader of the stream sniffing keys to tell
      // which lines are log entries.
      ctx.ui.info(interactiveRunnerMessages.runSubmitted(runId));
      return followRun(
        ctx,
        {
          logs: options.logs,
          recorderSinceSequence,
          runEvents: options.runEvents,
          runId,
          runnerId: resolved.runnerId,
          timeoutSeconds: timeout.seconds,
        },
        deps,
      );
    }
    // An outcome added to the contract must not fall through to exit 0: today
    // the response schema refuses one this version does not know, and this
    // keeps a future contracts bump a compile error rather than a silent pass.
    default: {
      result.value satisfies never;
      return {
        error: interactiveRunnerMessages.runSubmitAnsweredUnknown(
          String((result.value as { outcome: string }).outcome),
        ),
        exitCode: exitCodes.network,
      };
    }
  }
}
