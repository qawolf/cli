import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { resolveRunner } from "./resolveRunner.js";
import { runnerCallOptions } from "./runnerCallOptions.js";

/**
 * Accepts a run's screenshot as the new baseline for an image diff. Both paths
 * are the ones the diff reported, which reach a caller on the runner's
 * `run-events` journal stream.
 */
export async function handleRunnerPromoteSnapshot(
  ctx: AuthCommandContext,
  options: {
    baselinePath: string;
    runner: string | undefined;
    screenshotPath: string;
  },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  // Never launches: the screenshot being promoted lives on the runner that
  // produced it, and a fresh one holds nothing.
  const resolved = await resolveRunner(
    ctx,
    {
      autoLaunch: false,
      noRunnerIdMessage: interactiveRunnerMessages.noRunnerIdForPromoteSnapshot,
      runner: options.runner,
    },
    deps,
  );
  if (resolved.type === "failed") {
    return { ...failureFields(resolved), exitCode: resolved.exitCode };
  }

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.promoteSnapshot,
    {
      baselinePath: options.baselinePath,
      id: resolved.runnerId,
      screenshotPath: options.screenshotPath,
    },
    runnerCallOptions,
  );
  if (!result.ok) {
    return { ...failureFields(result), exitCode: exitCodes.network };
  }

  if (result.value.outcome === "success") {
    ctx.ui.output(
      result.value,
      interactiveRunnerMessages.snapshotPromoted(
        options.screenshotPath,
        options.baselinePath,
      ),
    );
    return undefined;
  }

  const { failureReason } = result.value;
  switch (failureReason) {
    // Nothing was changed, so correcting the path and repeating is safe.
    case "snapshot-not-found":
      return {
        error: interactiveRunnerMessages.snapshotNotFound(
          options.screenshotPath,
        ),
        exitCode: exitCodes.invalidArgs,
      };
    case "runner-cannot-promote-snapshots":
      return {
        error: interactiveRunnerMessages.runnerCannotPromoteSnapshots,
        exitCode: exitCodes.invalidArgs,
      };
    // A promotion that landed is not undone by promoting again, so a retry
    // after this is safe.
    case "runner-unreachable":
      return {
        error: interactiveRunnerMessages.runnerUnreachable,
        exitCode: exitCodes.network,
      };
    default: {
      failureReason satisfies never;
      return {
        error:
          interactiveRunnerMessages.promoteSnapshotAnsweredUnknown(
            failureReason,
          ),
        exitCode: exitCodes.network,
      };
    }
  }
}
