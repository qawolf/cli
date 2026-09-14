import type { AgentSession } from "~/core/agent/session.js";
import { agentMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

/**
 * The session record on stdout where a machine is reading, so a follow ends
 * with the same object a plain `agent get` answers with: the replies as lines
 * while they arrive, then the whole session with its final status and url.
 */
export function endWithSession(
  ctx: AuthCommandContext,
  session: AgentSession,
): void {
  if (ctx.ui.mode !== "human") ctx.ui.json(session);
}

/** The end of a follow, as the command's result. */
export function reportSettlement(
  ctx: AuthCommandContext,
  session: AgentSession,
): CommandResult {
  endWithSession(ctx, session);
  if (session.status === "completed") {
    ctx.ui.success(agentMessages.sessionCompleted);
    return undefined;
  }
  return {
    error:
      session.status === "cancelled"
        ? agentMessages.sessionCancelled(session.url)
        : agentMessages.sessionFailed(session.url),
    exitCode: exitCodes.testFailure,
  };
}
