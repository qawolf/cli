import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import type { z } from "zod";

import { replyParts } from "~/core/agent/formatReply.js";
import { isSettled, pendingQuestion } from "~/core/agent/session.js";
import { agentMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import {
  type PlatformResult,
  failureFields,
} from "~/shell/platform/requestWithRetry.js";

import { handleQuestion } from "./answerQuestion.js";
import type { AgentDeps } from "./deps.js";
import { planHold } from "./hold.js";
import { reportSettlement } from "./settlement.js";

const maxSessionsPerWait = 20;

type ActivityAnswer = PlatformResult<
  z.output<typeof publicContractsV1.activity.wait.output>
>;

function splitIntoWaits(sessionIds: readonly string[]): string[][] {
  return [
    ...Array(Math.ceil(sessionIds.length / maxSessionsPerWait)).keys(),
  ].map((index) =>
    sessionIds.slice(
      index * maxSessionsPerWait,
      (index + 1) * maxSessionsPerWait,
    ),
  );
}

export async function followSessions(options: {
  ctx: AuthCommandContext;
  deps: AgentDeps;
  sessionIds: readonly string[];
  timeoutSeconds: number;
}): Promise<CommandResult> {
  const { ctx, deps, sessionIds, timeoutSeconds } = options;
  const deadline = deps.now() + timeoutSeconds * 1000;
  const remainingMs = () => deadline - deps.now();
  const timedOut = () => ({
    error: agentMessages.followSessionsTimedOut({
      seconds: timeoutSeconds,
      sessionIds,
    }),
    exitCode: exitCodes.timeout,
  });
  const waiting = ctx.ui.wait(agentMessages.waiting);
  const detach = ctx.signals.register(() => waiting.stop());
  const waits = splitIntoWaits(sessionIds);
  const cursorsByWait = new Map<number, Record<string, string>>();
  const holds = new Map<
    number,
    Promise<{ answer: ActivityAnswer; index: number }>
  >();

  try {
    for (;;) {
      if (remainingMs() <= 0) return timedOut();
      waits.forEach((waitSessionIds, index) => {
        if (holds.has(index)) return;
        const hold = planHold(remainingMs);
        const held = ctx.platformClient.callPublicApi(
          publicContractsV1.activity.wait,
          {
            cursors: cursorsByWait.get(index) ?? {},
            sessionIds: waitSessionIds,
            waitSeconds: hold.waitSeconds,
          },
          hold.requestOptions,
        );
        holds.set(
          index,
          held.then((answer) => ({ answer, index })),
        );
      });
      const { answer, index } = await Promise.race(holds.values());
      holds.delete(index);
      if (!answer.ok) {
        if (answer.timedOut || remainingMs() <= 0) continue;
        return { exitCode: exitCodes.network, ...failureFields(answer) };
      }
      cursorsByWait.set(
        index,
        Object.fromEntries(
          answer.value.sessions.map((watched) => [
            watched.sessionId,
            watched.nextCursor,
          ]),
        ),
      );
      const stirred = answer.value.sessions.filter(
        (watched) => watched.status !== "working",
      );

      for (const { sessionId } of stirred) {
        const readRemainingMs = remainingMs();
        if (readRemainingMs <= 0) return timedOut();
        const read = await ctx.platformClient.callPublicApi(
          publicContractsV1.agent.get,
          { sessionId, waitSeconds: 0 },
          { timeoutMs: Math.min(15_000, readRemainingMs) },
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
