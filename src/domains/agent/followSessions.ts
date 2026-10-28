import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { replyParts } from "~/core/agent/formatReply.js";
import { isSettled, pendingQuestion } from "~/core/agent/session.js";
import { agentMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import { handleQuestion } from "./answerQuestion.js";
import type { AgentDeps } from "./deps.js";
import { holdWithin } from "./hold.js";
import { reportSettlement } from "./settlement.js";

export async function followSessions(options: {
  ctx: AuthCommandContext;
  deps: AgentDeps;
  sessionIds: readonly string[];
  timeoutSeconds: number;
}): Promise<CommandResult> {
  const { ctx, deps, sessionIds, timeoutSeconds } = options;
  const deadline = deps.now() + timeoutSeconds * 1000;
  const timedOut = () => ({
    error: agentMessages.followSessionsTimedOut({
      seconds: timeoutSeconds,
      sessionIds,
    }),
    exitCode: exitCodes.timeout,
  });
  const waiting = ctx.ui.wait(agentMessages.waiting);
  const detach = ctx.signals.register(() => waiting.stop());

  try {
    let cursors: Record<string, string> = {};
    for (;;) {
      const holdRemainingMs = deadline - deps.now();
      if (holdRemainingMs <= 0) return timedOut();
      const hold = holdWithin(holdRemainingMs);
      const activity = await ctx.platformClient.callPublicApi(
        publicContractsV1.activity.wait,
        { cursors, sessionIds: [...sessionIds], waitSeconds: hold.waitSeconds },
        { timeoutMs: hold.timeoutMs },
      );
      if (!activity.ok) {
        if (deps.now() >= deadline) return timedOut();
        return { exitCode: exitCodes.network, ...failureFields(activity) };
      }
      cursors = Object.fromEntries(
        activity.value.sessions.map((watched) => [
          watched.sessionId,
          watched.nextCursor,
        ]),
      );
      const stirred = activity.value.sessions.filter(
        (watched) => watched.status !== "working",
      );

      for (const { sessionId } of stirred) {
        const remainingMs = deadline - deps.now();
        if (remainingMs <= 0) return timedOut();
        const read = await ctx.platformClient.callPublicApi(
          publicContractsV1.agent.get,
          { sessionId, waitSeconds: 0 },
          { timeoutMs: Math.min(15_000, remainingMs) },
        );
        if (!read.ok) {
          if (deps.now() >= deadline) return timedOut();
          return { exitCode: exitCodes.network, ...failureFields(read) };
        }
        const session = read.value;
        const question = pendingQuestion(session.status, session.replies);
        if (!isSettled(session.status) && question === undefined) continue;

        waiting.stop();
        ctx.ui.info(agentMessages.sessionAt(session.url));
        if (ctx.ui.mode !== "json") {
          for (const reply of session.replies) {
            ctx.ui.transcript({
              ...replyParts(reply, { listChoices: true }),
              data: reply,
            });
          }
        }
        if (isSettled(session.status)) return reportSettlement(ctx, session);
        if (question !== undefined) {
          const result = await handleQuestion(ctx, {
            canPrompt: false,
            question,
            session,
            sessionId,
            workspaceId: undefined,
          });
          if (result.type === "ended") return result.result;
        }
      }
    }
  } finally {
    waiting.stop();
    detach();
  }
}
