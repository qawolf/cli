import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { exitCodes } from "~/shell/exit.js";
import {
  failureFields,
  type PlatformFailure,
} from "~/shell/platform/requestWithRetry.js";

import type { TargetedRunner } from "./resolveRunner.js";

type RunnerFailure = {
  error: string;
  errorBody?: string;
  exitCode: number;
};

/**
 * A failed call to a runner, as a command result.
 *
 * The platform answers a runner that is not running with a 404, which is the
 * one failure here that no amount of retrying clears — the pod was terminated
 * or idled out, and only a launch brings one back. It exits `notFound` rather
 * than `network` so a caller can stop instead of retrying a dead id, and it
 * names where the id came from, since that is what a reader has to change.
 */
export function runnerRequestFailure(
  failure: PlatformFailure,
  runner: TargetedRunner,
): RunnerFailure {
  const fields = failureFields(failure);
  if (failure.exitCode !== exitCodes.notFound) {
    return { ...fields, exitCode: failure.exitCode ?? exitCodes.network };
  }
  const cameFrom = interactiveRunnerMessages.runnerIdCameFrom(
    runner.runnerId,
    runner.source,
  );
  return {
    ...fields,
    errorBody: fields.errorBody ? `${fields.errorBody}\n${cameFrom}` : cameFrom,
    exitCode: exitCodes.notFound,
  };
}
