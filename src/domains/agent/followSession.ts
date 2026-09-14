import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { replyParts } from "~/core/agent/formatReply.js";
import {
  type AgentSession,
  isSettled,
  pendingQuestion,
} from "~/core/agent/session.js";
import { agentMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import { handleQuestion } from "./answerQuestion.js";
import type { AgentDeps } from "./deps.js";
import { reportSettlement } from "./settlement.js";

const pollIntervalMs = 5_000;

export type FollowOptions = {
  sessionId: string;
  timeoutSeconds: number;
  /** A read already in hand, followed from rather than fetched again. */
  initial: AgentSession | undefined;
  /** Replies the session held when a message was just sent to it; see {@link handleQuestion}. */
  repliesAtAnswer: number | undefined;
  /** Sent with every answer, for a credential not bound to one workspace. */
  workspaceId: string | undefined;
};

// Every reply as it arrives is as fine-grained as the platform reports today:
// `agent.get` says `working` and nothing more until the AI speaks, and the
// whole transcript comes back on every read, so "new" means past what has
// already been printed.
/**
 * Follows a session until it settles, answering what it asks along the way.
 * Where nothing can be typed, a question ends the follow cleanly instead; see
 * {@link handleQuestion}.
 */
export async function followSession(
  ctx: AuthCommandContext,
  options: FollowOptions,
  deps: AgentDeps,
): Promise<CommandResult> {
  const { sessionId, workspaceId } = options;
  const canPrompt = ctx.ui.mode === "human" && ctx.isInteractive;
  // Elapsed time, requests included, less the time spent at a prompt: a person
  // who took ten minutes to answer has not used up ten minutes of the follow.
  const startedAt = deps.now();
  let promptedMs = 0;
  const timedOut = () =>
    deps.now() - startedAt - promptedMs >= options.timeoutSeconds * 1_000;

  let pending = options.initial;
  let printed = 0;
  let { repliesAtAnswer } = options;
  let saidDetachHint = false;
  let waiting: { stop(): void } | undefined;
  // Before anything else is printed, and on the way out: a wait line left
  // running under a log line, a prompt or an exit is redrawn over them.
  const stopWaiting = () => {
    waiting?.stop();
    waiting = undefined;
  };

  const detach = ctx.signals.register(() => {
    stopWaiting();
    ctx.ui.info(agentMessages.detached(sessionId));
  });

  try {
    for (let poll = 1; ; poll++) {
      let session: AgentSession;
      if (pending !== undefined) {
        session = pending;
        pending = undefined;
      } else {
        const read = await ctx.platformClient.callPublicApi(
          publicContractsV1.agent.get,
          { sessionId },
        );
        if (!read.ok) {
          return { exitCode: exitCodes.network, ...failureFields(read) };
        }
        session = read.value;
      }
      const { replies, status } = session;

      const fresh = replies.slice(printed);
      printed = replies.length;
      if (fresh.length > 0) stopWaiting();
      for (const reply of fresh) {
        ctx.ui.transcript({
          ...replyParts(reply, { listChoices: !canPrompt }),
          data: reply,
        });
      }
      if (poll === 1 && replies.length === 0 && !isSettled(status)) {
        ctx.ui.info(agentMessages.working);
      }

      if (isSettled(status)) {
        stopWaiting();
        return reportSettlement(ctx, session);
      }

      const question = pendingQuestion(status, replies);
      // Skipped while the transcript has not moved past the answer already
      // sent: the status lags the send, and re-prompting would ask it twice.
      const awaitingOurAnswer =
        repliesAtAnswer !== undefined && replies.length <= repliesAtAnswer;
      if (question !== undefined && !awaitingOurAnswer) {
        stopWaiting();
        const promptStartedAt = deps.now();
        const step = await handleQuestion(ctx, {
          canPrompt,
          question,
          session,
          sessionId,
          workspaceId,
        });
        promptedMs += deps.now() - promptStartedAt;
        if (step.type === "ended") return step.result;
        repliesAtAnswer = step.repliesAtAnswer;
      }

      if (!saidDetachHint && ctx.ui.mode === "human") {
        saidDetachHint = true;
        ctx.ui.info(agentMessages.detachHint);
      }
      waiting ??= ctx.ui.wait(agentMessages.waiting);
      await deps.sleep(pollIntervalMs);
      if (timedOut()) {
        return {
          error: agentMessages.followTimedOut(
            sessionId,
            options.timeoutSeconds,
          ),
          exitCode: exitCodes.timeout,
        };
      }
    }
  } finally {
    stopWaiting();
    detach();
  }
}
