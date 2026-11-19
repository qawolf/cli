import { randomUUID } from "node:crypto";

import { publicContractsV1 } from "@qawolf/api-contracts/v1";
import { z } from "zod";

import { slackMessages } from "~/core/messages/index.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";
import { failureFields } from "~/shell/platform/requestWithRetry.js";

type SlackPostAnswer = z.output<typeof publicContractsV1.slack.post.output>;

type Refusal = Exclude<SlackPostAnswer, { outcome: "posted" }>;

export type SlackPostOptions = {
  channel: string;
  text: string;
  thread: string | undefined;
};

export type SlackPostDeps = { makeNewId: () => string };

export const slackPostDeps: SlackPostDeps = { makeNewId: randomUUID };

function refusalMessage(refusal: Refusal, channelId: string): string {
  switch (refusal.outcome) {
    case "not-a-loop-session":
      return slackMessages.notALoopSession;
    case "loop-deleted":
      return slackMessages.loopDeleted;
    case "channel-not-allowed":
      return slackMessages.channelNotAllowed(channelId);
    case "agent-not-in-channel":
      return slackMessages.agentNotInChannel(channelId);
    case "rate-limited":
      return slackMessages.rateLimited;
  }
}

export async function handleSlackPost(
  ctx: AuthCommandContext,
  options: SlackPostOptions,
  deps: SlackPostDeps,
): Promise<CommandResult> {
  const input = publicContractsV1.slack.post.input.safeParse({
    channelId: options.channel,
    newId: deps.makeNewId(),
    text: options.text,
    threadTs: options.thread,
  });
  if (!input.success) {
    return {
      error: z.prettifyError(input.error),
      exitCode: exitCodes.invalidArgs,
    };
  }

  const result = await ctx.platformClient.callPublicApi(
    publicContractsV1.slack.post,
    input.data,
  );
  if (!result.ok) return failureFields(result);

  const answer = result.value;
  if (answer.outcome === "posted") {
    ctx.ui.output(answer, slackMessages.posted(answer.permalink));
    return undefined;
  }

  return {
    error: refusalMessage(answer, input.data.channelId),
    errorBody: answer.message,
    exitCode: exitCodes.testFailure,
  };
}
