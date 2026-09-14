import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type { AgentReply, AgentSession } from "~/core/agent/session.js";
import { agentMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

import { endWithSession } from "./settlement.js";

/**
 * `answered` carries how many replies the transcript held at the moment the
 * answer went out. The status stays `waiting-for-you` until the platform picks
 * the answer up, so a follow that re-prompted on the next poll would ask the
 * same question again; the caller holds this and waits for the transcript to
 * move past it.
 */
type AnswerOutcome =
  | { type: "answered"; repliesAtAnswer: number }
  | { type: "declined" }
  | { type: "failed"; result: CommandResult };

async function ask(
  ctx: AuthCommandContext,
  question: AgentReply,
): Promise<string | undefined> {
  const choices = question.choices ?? [];
  const answer =
    choices.length > 0
      ? await ctx.ui.select(
          agentMessages.answerPrompt,
          choices.map((choice) => ({ label: choice, value: choice })),
        )
      : await ctx.ui.text(agentMessages.answerPrompt);
  return answer.ok ? answer.value : undefined;
}

// The workspace goes with every answer for the same reason it went with the
// request that opened the session: a credential not bound to one workspace
// has to name it on every call.
async function answerQuestion(
  ctx: AuthCommandContext,
  options: {
    question: AgentReply;
    repliesSoFar: number;
    sessionId: string;
    workspaceId: string | undefined;
  },
): Promise<AnswerOutcome> {
  const answer = await ask(ctx, options.question);
  if (answer === undefined) {
    ctx.ui.warn(agentMessages.answerCancelled);
    return { type: "declined" };
  }

  const sent = await ctx.platformClient.callPublicApi(
    publicContractsV1.agent.send,
    {
      message: answer,
      sessionId: options.sessionId,
      ...(options.workspaceId === undefined
        ? {}
        : { workspaceId: options.workspaceId }),
    },
  );
  if (!sent.ok) {
    const failure = failureFields(sent);
    return {
      result: {
        exitCode: exitCodes.network,
        ...failure,
        error: agentMessages.answerSendFailed(failure.error),
      },
      type: "failed",
    };
  }
  return { repliesAtAnswer: options.repliesSoFar, type: "answered" };
}

/**
 * What a follow does with a session that is blocked on a question: put it to
 * the person watching and send the answer on, or, where nothing can be typed,
 * hand the work back and stop.
 *
 * `ended` carries the command's result, since a follow that stops here is the
 * command finishing. A session that asked a question has not failed, so the
 * handed-back case ends cleanly with the record a machine can act on.
 */
export async function handleQuestion(
  ctx: AuthCommandContext,
  options: {
    canPrompt: boolean;
    question: AgentReply;
    session: AgentSession;
    sessionId: string;
    workspaceId: string | undefined;
  },
): Promise<
  | { type: "answered"; repliesAtAnswer: number }
  | { type: "ended"; result: CommandResult }
> {
  const { session, sessionId } = options;
  if (!options.canPrompt) {
    ctx.ui.info(agentMessages.blocked(sessionId));
    endWithSession(ctx, session);
    return { result: undefined, type: "ended" };
  }
  const outcome = await answerQuestion(ctx, {
    question: options.question,
    repliesSoFar: session.replies.length,
    sessionId,
    workspaceId: options.workspaceId,
  });
  if (outcome.type === "failed")
    return { result: outcome.result, type: "ended" };
  if (outcome.type === "declined") return { result: undefined, type: "ended" };
  return outcome;
}
