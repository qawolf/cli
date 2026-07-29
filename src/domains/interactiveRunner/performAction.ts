import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import {
  type BrowserActionFlags,
  buildBrowserAction,
  parseBrowserAction,
} from "~/core/interactiveRunner/browserAction.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import type { InteractiveRunnerDeps } from "./deps.js";
import { announceRunner, resolveRunner } from "./resolveRunner.js";

/** `-` reads a whole action as JSON, which is the forward-a-tool-call path. */
const stdinArgument = "-";

async function readAction(
  type: string,
  flags: BrowserActionFlags,
  deps: InteractiveRunnerDeps,
): Promise<ReturnType<typeof buildBrowserAction>> {
  if (type !== stdinArgument) return buildBrowserAction(type, flags);

  const piped = (await deps.readStdin()).trim();
  if (piped === "") {
    return { error: interactiveRunnerMessages.stdinEmpty("action"), ok: false };
  }
  try {
    return parseBrowserAction(JSON.parse(piped));
  } catch {
    return {
      error: "Stdin did not hold a JSON action.",
      ok: false,
    };
  }
}

/**
 * Performs one raw browser action.
 *
 * One per call, and the runner serves one at a time, so there is no queue and the
 * caller decides what to do next from each answer. The action is admitted by the
 * published schema before it is sent, which is what turns a string too long for
 * the runner's keyboard into an immediate refusal naming the limit rather than a
 * round trip that holds the runner for ten seconds and then declines.
 */
export async function handleRunnerAct(
  ctx: AuthCommandContext,
  options: {
    flags: BrowserActionFlags;
    runner: string | undefined;
    type: string;
  },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const built = await readAction(options.type, options.flags, deps);
  if (!built.ok) return { error: built.error, exitCode: exitCodes.invalidArgs };

  const resolved = await resolveRunner(
    ctx,
    { autoLaunch: true, runner: options.runner },
    deps,
  );
  if (resolved.type === "failed") {
    return { error: resolved.error, exitCode: resolved.exitCode };
  }
  announceRunner(ctx, resolved);

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.runner.performAction,
    { action: built.action, id: resolved.runnerId },
  );
  if (!result.ok) return { error: result.error, exitCode: exitCodes.network };

  switch (result.value.outcome) {
    case "performed":
      ctx.ui.output(
        { action: built.action, outcome: "performed" },
        interactiveRunnerMessages.actionPerformed(built.action.type),
      );
      return undefined;
    // Attempted and did not take effect, which is an answer rather than a fault.
    case "action-failed":
      return {
        error: interactiveRunnerMessages.actionFailed(
          result.value.errorMessage,
        ),
        exitCode: exitCodes.testFailure,
      };
    case "screen-not-ready":
      return {
        error: interactiveRunnerMessages.screenNotReady,
        exitCode: exitCodes.network,
      };
    case "runner-has-no-screen":
      return {
        error: interactiveRunnerMessages.runnerHasNoScreen,
        exitCode: exitCodes.invalidArgs,
      };
    // Alone among these verbs, this one may have taken effect before its answer
    // was lost, so the message must not invite a bare repeat.
    case "runner-unreachable":
      return {
        error: interactiveRunnerMessages.actionMayHaveHappened,
        exitCode: exitCodes.network,
      };
  }
}
