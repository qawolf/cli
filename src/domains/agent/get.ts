import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { replyParts } from "~/core/agent/formatReply.js";
import {
  type AgentSession,
  defaultAgentFollowTimeoutSeconds,
} from "~/core/agent/session.js";
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
import { chooseGivenSessionId, resolveSessionId } from "./resolveSessionId.js";

export type AgentGetOptions = {
  follow: boolean;
  /** The id given as an argument, as `agent get <session>`. */
  sessionArgument: string | undefined;
  /** The id given as `--session <id>`. */
  session: string | undefined;
  timeout: string | undefined;
  /** Sent with every answer given during a follow. */
  workspaceId: string | undefined;
};

// The transcript as framed messages, then the session as the command's one
// result: `output` puts the object on stdout for a machine and one line of
// where the session stands for a person. json mode gets the object alone,
// since the replies are inside it.
function renderSession(ctx: AuthCommandContext, session: AgentSession): void {
  if (ctx.ui.mode !== "json") {
    for (const reply of session.replies) {
      ctx.ui.transcript({
        ...replyParts(reply, { listChoices: true }),
        data: reply,
      });
    }
  }
  ctx.ui.output(session, agentMessages.standing(session.status, session.url));
}

/**
 * Reads a session: everything it has said and where it stands, or the same plus
 * everything it says from here on with `--follow`.
 */
export async function handleAgentGet(
  ctx: AuthCommandContext,
  options: AgentGetOptions,
  deps: AgentDeps,
): Promise<CommandResult> {
  const timeout = parseFollowTimeout(
    options.timeout,
    defaultAgentFollowTimeoutSeconds,
  );
  if (!timeout.ok) {
    return { error: timeout.error, exitCode: exitCodes.invalidArgs };
  }

  const given = chooseGivenSessionId({
    argument: options.sessionArgument,
    flag: options.session,
  });
  if (!given.ok) {
    return { error: given.error, exitCode: exitCodes.invalidArgs };
  }

  const sessionId = await resolveSessionId(given.sessionId, deps);
  if (sessionId === undefined) {
    return { error: agentMessages.noSession, exitCode: exitCodes.invalidArgs };
  }

  const read = await ctx.platformClient.callPublicApi(
    publicContractsV1.agent.get,
    { sessionId },
  );
  if (!read.ok) return { exitCode: exitCodes.network, ...failureFields(read) };

  if (!options.follow) {
    renderSession(ctx, read.value);
    return undefined;
  }

  // `agent send` says where its session went; a follow that attaches to one
  // has said nothing yet. The read is then followed from, not fetched again.
  ctx.ui.info(agentMessages.sessionAt(read.value.url));
  return followSession(
    ctx,
    {
      initial: read.value,
      repliesAtAnswer: undefined,
      sessionId,
      timeoutSeconds: timeout.seconds,
      workspaceId: options.workspaceId,
    },
    deps,
  );
}
