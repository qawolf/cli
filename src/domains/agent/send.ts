import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { defaultAgentFollowTimeoutSeconds } from "~/core/agent/session.js";
import { parseFollowTimeout } from "~/core/followTimeout.js";
import { agentMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import type { AgentDeps } from "./deps.js";
import { followSession } from "./followSession.js";

export type AgentSendOptions = {
  environmentId: string | undefined;
  follow: boolean;
  message: string;
  session: string | undefined;
  timeout: string | undefined;
  workspaceId: string | undefined;
};

// Validated locally before any network call, as the generated commands do, so
// an empty or oversize message gets field-level feedback rather than a server
// error.
//
// The session is the flag alone, never the environment variable or the stored
// session that `agent get` falls back to: a bare `agent send` opens a new
// session, and silently attaching it to the last one would put unrelated work
// in one conversation on the strength of a variable left set from an earlier
// task.
function parseInput(options: AgentSendOptions) {
  return publicContractsV1.agent.send.input.safeParse({
    message: options.message,
    ...(options.environmentId === undefined
      ? {}
      : { environmentId: options.environmentId }),
    ...(options.session === undefined ? {} : { sessionId: options.session }),
    ...(options.workspaceId === undefined
      ? {}
      : { workspaceId: options.workspaceId }),
  });
}

/**
 * Asks QA Wolf to do a piece of work, and optionally stays to watch it.
 *
 * The session id is remembered here whether or not the follow was asked for, so
 * that a caller who fired the work off and walked away can pick it up later
 * with a bare `qawolf agent get --follow`.
 */
export async function handleAgentSend(
  ctx: AuthCommandContext,
  options: AgentSendOptions,
  deps: AgentDeps,
): Promise<CommandResult> {
  const timeout = parseFollowTimeout(
    options.timeout,
    defaultAgentFollowTimeoutSeconds,
  );
  if (!timeout.ok) {
    return { error: timeout.error, exitCode: exitCodes.invalidArgs };
  }
  const input = parseInput(options);
  if (!input.success) {
    return {
      error: z.prettifyError(input.error),
      exitCode: exitCodes.invalidArgs,
    };
  }

  // A message into a session that is still being followed afterwards may be
  // the answer to its open question, and the session's status lags the send.
  // The reply count from before the send is what tells the follow which
  // question is already answered and which arrived since.
  let repliesAtAnswer: number | undefined;
  if (options.follow && options.session !== undefined) {
    const before = await ctx.platformClient.callPublicApi(
      publicContractsV1.agent.get,
      { sessionId: options.session },
    );
    if (!before.ok) {
      return { exitCode: exitCodes.network, ...failureFields(before) };
    }
    repliesAtAnswer = before.value.replies.length;
  }

  const sent = await ctx.platformClient.callPublicApi(
    publicContractsV1.agent.send,
    input.data,
  );
  if (!sent.ok) return { exitCode: exitCodes.network, ...failureFields(sent) };

  ctx.ui.output(
    sent.value,
    agentMessages.started(sent.value.sessionId, sent.value.url),
  );
  await deps.store.rememberSession(sent.value.sessionId).catch(() => undefined);
  if (!options.follow) return undefined;

  return followSession(
    ctx,
    {
      initial: undefined,
      repliesAtAnswer,
      sessionId: sent.value.sessionId,
      timeoutSeconds: timeout.seconds,
      workspaceId: options.workspaceId,
    },
    deps,
  );
}
