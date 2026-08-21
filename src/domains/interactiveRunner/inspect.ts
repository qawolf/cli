import {
  type InspectOnRunnerRequest,
  publicContractsV1,
} from "@qawolf/api-contracts/v1";

import {
  buildInspectRequest,
  type InspectFlags,
} from "~/core/interactiveRunner/inspectRequest.js";
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
 * Reads one thing off a runner's live page and prints it.
 *
 * The value goes to stdout on its own, so a caller can pipe it into a file or a
 * parser. Everything else the command has to say goes to stderr, because a
 * diagnostic mixed into the value would corrupt whatever is reading it.
 */
export async function handleRunnerInspect(
  ctx: AuthCommandContext,
  options: {
    flags: InspectFlags;
    runner: string | undefined;
    what: InspectOnRunnerRequest["what"];
  },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const built = buildInspectRequest(options.what, options.flags);
  if (!built.ok) {
    return { error: built.error, exitCode: exitCodes.invalidArgs };
  }

  const resolved = await resolveRunner(
    ctx,
    {
      autoLaunch: false,
      noRunnerIdMessage: interactiveRunnerMessages.noRunnerIdForInspect,
      runner: options.runner,
    },
    deps,
  );
  if (resolved.type === "failed") {
    return { ...failureFields(resolved), exitCode: resolved.exitCode };
  }

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.inspect,
    { id: resolved.runnerId, request: built.request },
    runnerCallOptions,
  );
  if (!result.ok) {
    return { ...failureFields(result), exitCode: exitCodes.network };
  }

  if (result.value.outcome === "failure") {
    const failure = result.value;
    const { failureReason } = failure;
    switch (failureReason) {
      // A pod cannot tell a missing page from a missing element
      // from a missing variable. None of them clears by waiting,
      // so this is not a retry.
      case "nothing-to-inspect":
        return {
          error: interactiveRunnerMessages.nothingToInspect(
            failure.errorMessage,
          ),
          exitCode: exitCodes.invalidArgs,
        };
      case "runner-unreachable":
        return {
          error: interactiveRunnerMessages.runnerUnreachable,
          exitCode: exitCodes.network,
        };
      default: {
        failureReason satisfies never;
        return {
          error:
            interactiveRunnerMessages.inspectAnsweredUnknown(failureReason),
          exitCode: exitCodes.network,
        };
      }
    }
  }

  ctx.ui.stream(result.value, result.value.value);
  return undefined;
}
