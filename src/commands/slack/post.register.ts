import { loopSlackPostsPerSession } from "@qawolf/api-contracts/v1";
import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { handleSlackPost, slackPostDeps } from "~/domains/slack/post.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

const postExamples = `
Examples:
  $ qawolf slack post --channel C0123ABCD --text "Nightly smoke passed"
  $ qawolf slack post --channel C0123ABCD --text "Fixed in #482" --thread 1792000776.456809`;

type PostFlags = {
  channel: string;
  text: string;
  thread?: string;
};

export function registerSlackPostCommand(
  slack: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(slack.command("post"), "write")
    .description(
      `Post a message, or a reply in a message's thread, in one of the workspace's own Slack channels as the QA Wolf agent. Only a QA Wolf session that a loop started can post, at most ${loopSlackPostsPerSession} times per loop run`,
    )
    .requiredOption(
      "--channel <id>",
      "The Slack channel ID, such as C0123ABCD. The QA Wolf agent must be in the channel",
    )
    .requiredOption("--text <text>", "The message, in Slack mrkdwn")
    .option(
      "--thread <ts>",
      "The timestamp of a message in the channel, such as 1792000776.456809, to reply in its thread",
    )
    .addHelpText("after", postExamples)
    .action((opts: PostFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleSlackPost(
          ctx,
          { channel: opts.channel, text: opts.text, thread: opts.thread },
          slackPostDeps,
        ),
      )(opts, command),
    );
}
