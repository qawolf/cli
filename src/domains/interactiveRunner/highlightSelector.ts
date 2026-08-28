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
 * Draws on the runner's live page so the next screenshot shows what a selector
 * matches. A caller cannot see the runner's screen, so this is how it checks a
 * locator points at what it thinks.
 *
 * A selector the page could not parse is the caller's to fix and exits non-zero.
 * One that parsed and matched nothing is not: the call did what was asked, and
 * the count is the answer.
 */
export async function handleRunnerHighlightSelector(
  ctx: AuthCommandContext,
  options: { runner: string | undefined; selector: string | undefined },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  // Never launches: a highlight needs a live page, which a runner only has once
  // a run has opened one.
  const resolved = await resolveRunner(
    ctx,
    {
      autoLaunch: false,
      noRunnerIdMessage: interactiveRunnerMessages.noRunnerIdForHighlight,
      runner: options.runner,
    },
    deps,
  );
  if (resolved.type === "failed") {
    return { ...failureFields(resolved), exitCode: resolved.exitCode };
  }

  // An omitted selector is the clear, which the contract spells as an empty one.
  const selector = options.selector ?? "";
  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.highlightSelector,
    { id: resolved.runnerId, selector },
    runnerCallOptions,
  );
  if (!result.ok) {
    return { ...failureFields(result), exitCode: exitCodes.network };
  }

  const { outcome } = result.value;
  switch (outcome) {
    case "cleared":
      ctx.ui.output(result.value, interactiveRunnerMessages.highlightCleared);
      return undefined;
    case "success": {
      const answer = result.value;
      if (answer.status === "invalid") {
        return {
          error: interactiveRunnerMessages.highlightSelectorInvalid(
            answer.selector,
          ),
          exitCode: exitCodes.invalidArgs,
        };
      }
      ctx.ui.output(
        answer,
        answer.status === "empty"
          ? interactiveRunnerMessages.highlightMatchedNothing(answer.selector)
          : interactiveRunnerMessages.highlightMatched(
              answer.matchCount,
              answer.targetPage,
            ),
      );
      return undefined;
    }
    case "failure":
      return describeFailure(result.value.failureReason);
    default:
      outcome satisfies never;
      return {
        error: interactiveRunnerMessages.highlightAnsweredUnknown(outcome),
        exitCode: exitCodes.network,
      };
  }
}

function describeFailure(
  failureReason:
    | "no-answer"
    | "runner-cannot-highlight-selectors"
    | "runner-unreachable",
): CommandResult {
  switch (failureReason) {
    // The highlight runs inside the page, so this is the page being gone or
    // mid-navigation rather than the runner being slow.
    case "no-answer":
      return {
        error: interactiveRunnerMessages.highlightNoAnswer,
        exitCode: exitCodes.network,
      };
    case "runner-cannot-highlight-selectors":
      return {
        error: interactiveRunnerMessages.runnerCannotHighlightSelectors,
        exitCode: exitCodes.invalidArgs,
      };
    case "runner-unreachable":
      return {
        error: interactiveRunnerMessages.runnerUnreachable,
        exitCode: exitCodes.network,
      };
    default:
      failureReason satisfies never;
      return {
        error:
          interactiveRunnerMessages.highlightAnsweredUnknown(failureReason),
        exitCode: exitCodes.network,
      };
  }
}
