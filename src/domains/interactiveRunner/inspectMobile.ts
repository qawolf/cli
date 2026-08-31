import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import {
  type InspectMobileFlags,
  buildInspectMobileRequest,
} from "~/core/interactiveRunner/inspectMobileRequest.js";
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

type InspectMobileOutput = z.infer<
  typeof publicContractsV1.runner.inspectMobile.output
>;
type InspectMobileSuccess = Extract<
  InspectMobileOutput,
  { outcome: "success" }
>;
type SessionStatus = Extract<
  InspectMobileSuccess,
  { what: "session" }
>["session"];

/** A one-line summary of `--what session`, one branch per session state. */
function describeSession(session: SessionStatus): string {
  switch (session.type) {
    case "ready":
      return session.deviceName === undefined
        ? `Session ready: ${session.platformName} (${session.sessionId}).`
        : `Session ready: ${session.platformName} on ${session.deviceName} (${session.sessionId}).`;
    case "unreachable":
      return `Session unreachable: ${session.error}`;
    case "ambiguous":
      return `${String(session.sessionCount)} Appium sessions are live; expected one.`;
    case "no-session":
      return "No Appium session is live.";
  }
}

/** The answer as JSON, on its own, so a caller can redirect or pipe it —
 * same reasoning as `inspect.ts` streaming `value.value`. `session` skips
 * this: its `describeSession` line is the whole answer. */
function streamLine(
  value: Exclude<InspectMobileSuccess, { what: "session" }>,
): string {
  switch (value.what) {
    case "contexts":
      return JSON.stringify({
        contexts: value.contexts,
        current: value.current,
      });
    case "page":
      return JSON.stringify({
        context: value.context,
        orientation: value.orientation,
        pageSource: value.pageSource,
      });
    case "elements":
      return JSON.stringify({ matches: value.matches });
  }
}

/**
 * Reads one thing off a mobile interactive runner. Never launches, same as
 * `screenshot`: a freshly started runner has no live Appium session yet.
 */
export async function handleRunnerInspectMobile(
  ctx: AuthCommandContext,
  options: {
    flags: InspectMobileFlags;
    runner: string | undefined;
    what: string;
  },
  deps: InteractiveRunnerDeps,
): Promise<CommandResult> {
  const built = buildInspectMobileRequest(options.what, options.flags);
  if (!built.ok) return { error: built.error, exitCode: exitCodes.invalidArgs };

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
    publicContractsV1.runner.inspectMobile,
    { id: resolved.runnerId, request: built.request },
    runnerCallOptions,
  );
  if (!result.ok) {
    return { ...failureFields(result), exitCode: exitCodes.network };
  }

  if (result.value.outcome === "success") {
    const value = result.value;
    if (value.what === "session") {
      ctx.ui.output(value, describeSession(value.session));
    } else {
      ctx.ui.stream(value, streamLine(value));
    }
    return undefined;
  }

  const { failureReason } = result.value;
  switch (failureReason) {
    case "runner-is-not-mobile":
      return {
        error: interactiveRunnerMessages.runnerIsNotMobile,
        exitCode: exitCodes.invalidArgs,
      };
    case "screen-needs-a-run":
      return {
        error: interactiveRunnerMessages.screenNeedsARun,
        exitCode: exitCodes.invalidArgs,
      };
    case "screen-not-ready":
      return {
        error: interactiveRunnerMessages.screenNotReady,
        exitCode: exitCodes.network,
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
          interactiveRunnerMessages.inspectMobileAnsweredUnknown(failureReason),
        exitCode: exitCodes.network,
      };
    }
  }
}
