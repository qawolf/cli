import type { BrowserAction, ScreenshotMode } from "@qawolf/api-contracts/v1";
import { maxActionsPerRequest } from "@qawolf/api-contracts/v1";

import { parseBrowserAction } from "~/core/interactiveRunner/browserAction.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { stdoutPath } from "~/shell/interactiveRunner/writeScreenshot.js";

import type { InteractiveRunnerDeps } from "./deps.js";

/** `-` reads the whole sequence as JSON from stdin, which is the forward-a-tool-call path. */
const stdinArgument = "-";

export type ReadActions =
  | { actions: BrowserAction[]; ok: true }
  | { error: string; ok: false };

/**
 * Reads a JSON array of actions off the command line, or off stdin when the
 * argument is `-`. Each action is admitted by the published schema before the
 * sequence is sent, so one bad action is refused here naming its index rather
 * than by the platform naming nothing.
 */
export async function readActions(
  argument: string,
  deps: InteractiveRunnerDeps,
): Promise<ReadActions> {
  const raw =
    argument === stdinArgument ? (await deps.readStdin()).trim() : argument;
  if (argument === stdinArgument && raw === "") {
    return { error: interactiveRunnerMessages.stdinEmptySequence, ok: false };
  }
  const parsed = parseJsonArray(raw);
  if (!parsed.ok) return parsed;
  if (parsed.items.length === 0)
    return { error: interactiveRunnerMessages.actionsEmpty, ok: false };
  if (parsed.items.length > maxActionsPerRequest) {
    return {
      error: interactiveRunnerMessages.actionsOverLimit(
        parsed.items.length,
        maxActionsPerRequest,
      ),
      ok: false,
    };
  }

  const built = parsed.items.map(parseBrowserAction);
  const firstRefused = built.findIndex((action) => !action.ok);
  const refused = built[firstRefused];
  if (refused !== undefined && !refused.ok) {
    return {
      error: interactiveRunnerMessages.actionsInvalidAt(
        firstRefused,
        refused.error,
      ),
      ok: false,
    };
  }
  return {
    actions: built.flatMap((action) => (action.ok ? [action.action] : [])),
    ok: true,
  };
}

function parseJsonArray(
  raw: string,
): { items: unknown[]; ok: true } | { error: string; ok: false } {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value)
      ? { items: value, ok: true }
      : { error: interactiveRunnerMessages.actionsNotJsonArray, ok: false };
  } catch {
    return { error: interactiveRunnerMessages.actionsNotJsonArray, ok: false };
  }
}

/** Refused before a runner is resolved, so nothing is billed for an answer that could not be written. */
export function refuseUnwritableFrames(
  ctx: AuthCommandContext,
  screenshotMode: ScreenshotMode,
  options: { screenshot: string | undefined },
): CommandResult {
  // Refused rather than ignored, for the same reason an action flag beside a
  // piped action is: a flag that changes nothing has to be answered.
  if (screenshotMode === "none" && options.screenshot !== undefined) {
    return {
      error: interactiveRunnerMessages.actionsScreenshotWithModeNone,
      exitCode: exitCodes.invalidArgs,
    };
  }
  if (screenshotMode !== "none" && options.screenshot === undefined) {
    return {
      error:
        screenshotMode === "each"
          ? interactiveRunnerMessages.actionsEachNeedsAPath
          : interactiveRunnerMessages.actionsFinalNeedsAPath,
      exitCode: exitCodes.invalidArgs,
    };
  }
  if (screenshotMode === "each" && options.screenshot === stdoutPath) {
    return {
      error: interactiveRunnerMessages.actionsEachToStdout,
      exitCode: exitCodes.invalidArgs,
    };
  }
  if (options.screenshot === stdoutPath && ctx.outputMode === "human") {
    return {
      error: interactiveRunnerMessages.stdoutIsATerminal("--screenshot"),
      exitCode: exitCodes.invalidArgs,
    };
  }
  return undefined;
}
