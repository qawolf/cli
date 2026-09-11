import { type Command, Option } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { environmentIdEnvironmentVariable } from "~/commands/publicApi/environmentOptions.js";
import { defaultAgentFollowTimeoutSeconds } from "~/core/agent/session.js";
import { handleAgentSend } from "~/domains/agent/send.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { agentDeps, timeoutFlagDescription } from "./context.js";

const sendExamples = `
Examples:
  $ qawolf agent send "cover the checkout journey"
  $ qawolf agent send "cover the checkout journey" --follow
  $ qawolf agent send "use the staging login test@example.com" --session <id>
  $ qawolf agent send "cover signup" --environment-id staging --follow`;

type SendFlags = {
  environmentId?: string;
  follow: boolean;
  session?: string;
  timeout: string;
  workspaceId?: string;
};

export function registerAgentSendCommand(
  agent: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(agent.command("send <message>"), "write")
    .description(
      "Ask the QA Wolf AI to do a piece of work, such as covering a journey or fixing a broken flow",
    )
    .option(
      "--follow",
      "Stay and report what QA Wolf says until the session settles, answering its questions as they come",
      false,
    )
    .option(
      "--session <id>",
      "Continue this session instead of opening a new one. Send an answer, or add context to work already running",
    )
    .addOption(
      new Option(
        "--environment-id <env>",
        "QA Wolf environment to work in, by id or alias. Ignored with --session, because a session keeps the environment it opened in",
      ).env(environmentIdEnvironmentVariable),
    )
    .option(
      "--workspace-id <id>",
      "The workspace to work in. Required when authenticating with an organization or user API key",
    )
    .option(
      "--timeout <seconds>",
      timeoutFlagDescription,
      String(defaultAgentFollowTimeoutSeconds),
    )
    .addHelpText("after", sendExamples)
    .action((message: string, opts: SendFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleAgentSend(
          ctx,
          {
            environmentId: opts.environmentId,
            follow: opts.follow,
            message,
            session: opts.session,
            timeout: opts.timeout,
            workspaceId: opts.workspaceId,
          },
          agentDeps(ctx),
        ),
      )(opts, command),
    );
}
