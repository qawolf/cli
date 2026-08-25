import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import {
  type InspectMobileFlags,
  buildInspectMobileRequest,
} from "~/core/interactiveRunner/inspectMobileRequest.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { pluralize } from "~/core/pluralize.js";
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
type InspectMobileRead = Extract<InspectMobileOutput, { outcome: "read" }>;
type SessionStatus = Extract<InspectMobileRead, { what: "session" }>["session"];

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

/** A one-line summary of a `read` answer, one branch per `what`. */
function describeRead(value: InspectMobileRead): string {
  switch (value.what) {
    case "session":
      return describeSession(value.session);
    case "contexts":
      return `${pluralize(value.contexts.length, "context", "contexts")} available; current is ${value.current}.`;
    case "page":
      return `Read the page source of context ${value.context} (${value.orientation}).`;
    case "elements":
      return `Found ${pluralize(value.matches.length, "matching element", "matching elements")}.`;
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

  switch (result.value.outcome) {
    case "read":
      ctx.ui.output(result.value, describeRead(result.value));
      return undefined;
    case "runner-is-not-mobile":
      return {
        error: interactiveRunnerMessages.runnerIsNotMobile,
        exitCode: exitCodes.invalidArgs,
      };
    case "no-live-session":
      return {
        error: interactiveRunnerMessages.noLiveSession,
        exitCode: exitCodes.invalidArgs,
      };
    case "session-not-ready":
      return {
        error: interactiveRunnerMessages.sessionNotReady,
        exitCode: exitCodes.network,
      };
    case "runner-unreachable":
      return {
        error: interactiveRunnerMessages.runnerUnreachable,
        exitCode: exitCodes.network,
      };
  }
}
