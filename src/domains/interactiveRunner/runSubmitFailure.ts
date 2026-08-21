import type { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

type RunSubmitFailure = Extract<
  z.output<typeof publicContractsV1.runner.runFlow.output>,
  { outcome: "failure" }
>;

/** Why a submission was refused, and what the caller should do about it. */
export function describeRunSubmitFailure(
  failure: RunSubmitFailure,
): CommandResult {
  const { failureReason } = failure;
  switch (failureReason) {
    case "runner-target-mismatch":
      return {
        error: interactiveRunnerMessages.targetMismatch(
          failure.runnerName,
          failure.requiredRunnerName,
        ),
        exitCode: exitCodes.invalidArgs,
      };
    // Unreachable until a request carries unchangedFiles, and reported rather
    // than retried. A full request cannot be answered with this, so a caller
    // seeing it has hit something other than a stale baseline.
    case "needs-full-sync":
      return {
        error: interactiveRunnerMessages.needsFullSync(failure.missingPaths),
        exitCode: exitCodes.network,
      };
    // Never a retry suggestion. The run may have started and been too slow to
    // say so, and running the flow again would bill a second one.
    case "runner-unreachable":
      return {
        error: interactiveRunnerMessages.submitMayHaveStarted,
        exitCode: exitCodes.network,
      };
    // Reported rather than passed over, for the reason handleRunnerRun gives
    // about an unknown outcome.
    default: {
      failureReason satisfies never;
      return {
        error:
          interactiveRunnerMessages.runSubmitAnsweredUnknown(failureReason),
        exitCode: exitCodes.network,
      };
    }
  }
}
