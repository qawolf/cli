import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { replyParts } from "~/core/agent/formatReply.js";
import { isSettled, pendingQuestion } from "~/core/agent/session.js";
import { agentMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import { handleQuestion } from "./answerQuestion.js";
import type { AgentDeps } from "./deps.js";
import { readSession } from "./hold.js";
import { reportSettlement } from "./settlement.js";
import {
  type Deadline,
  endedBy,
  holdWithinDeadline,
} from "./withinDeadline.js";

const maxSessionsPerWait = 20;

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
  const deadlineAt = deps.now() + timeoutSeconds * 1000;
  const remainingMs = () => deadlineAt - deps.now();
  const timedOut = () => ({
    error: agentMessages.followSessionsTimedOut({
      seconds: timeoutSeconds,
      sessionIds,
    }),
    exitCode: exitCodes.timeout,
  });
  const waiting = ctx.ui.wait(agentMessages.waiting);
  const detach = ctx.signals.register(() => waiting.stop());
  const abort = new AbortController();
  const deadline: Deadline = {
    remainingMs,
    signal: abort.signal,
    sleep: deps.sleep,
  };
  const waits = splitIntoWaits(sessionIds);
  const cursorsByWait = new Map<number, Record<string, string>>();
  const holdWait = (index: number, waitSessionIds: string[]) =>
    holdWithinDeadline(deadline, (plan) =>
      ctx.platformClient.callPublicApi(
        publicContractsV1.activity.wait,
        {
          cursors: cursorsByWait.get(index) ?? {},
          sessionIds: waitSessionIds,
          waitSeconds: plan.waitSeconds,
        },
        plan.requestOptions,
      ),
    ).then((held) => ({ held, index }));
  const holds = new Map<number, ReturnType<typeof holdWait>>();

  try {
    for (;;) {
      if (remainingMs() <= 0) return timedOut();
      waits.forEach((waitSessionIds, index) => {
        if (!holds.has(index))
          holds.set(index, holdWait(index, waitSessionIds));
      });
      const { held, index } = await Promise.race(holds.values());
      holds.delete(index);
      if (held.type !== "answered") return endedBy(held, timedOut());
      cursorsByWait.set(
        index,
        Object.fromEntries(
          held.value.sessions.map((watched) => [
            watched.sessionId,
            watched.nextCursor,
          ]),
        ),
      );
      const stirred = held.value.sessions.filter(
        (watched) => watched.status !== "working",
      );

      for (const { sessionId } of stirred) {
        const read = await readSession(ctx, deadline, sessionId);
        if (read.type !== "answered") return endedBy(read, timedOut());
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
    abort.abort();
    waiting.stop();
    detach();
  }
}
