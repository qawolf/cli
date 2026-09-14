import type { Command } from "commander";

import { declareCommandKind } from "~/commands/commandKind.js";
import { withAuthContext } from "~/commands/context.js";
import { defaultAgentFollowTimeoutSeconds } from "~/core/agent/session.js";
import { handleAgentGet } from "~/domains/agent/get.js";
import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import {
  agentDeps,
  sessionFlagDescription,
  timeoutFlagDescription,
} from "./context.js";

const getExamples = `
Examples:
  $ qawolf agent get
  $ qawolf agent get --follow
  $ qawolf agent get <sessionId> --follow
  $ qawolf agent get --session <sessionId>`;

type GetFlags = {
  follow: boolean;
  session?: string;
  timeout: string;
  workspaceId?: string;
};

export function registerAgentGetCommand(
  agent: Command,
  signals: SignalRegistry,
): void {
  declareCommandKind(agent.command("get [session]"), "read")
    .description(
      "Read what the QA Wolf AI has said and whether it is still working",
    )
    .option(
      "--follow",
      "Stay and report what QA Wolf says until the session settles, answering its questions as they come",
      false,
    )
    .option("--session <id>", sessionFlagDescription)
    .option(
      "--workspace-id <id>",
      "The workspace an answer given during --follow is sent to. Required when authenticating with an organization or user API key",
    )
    .option(
      "--timeout <seconds>",
      timeoutFlagDescription,
      String(defaultAgentFollowTimeoutSeconds),
    )
    .addHelpText("after", getExamples)
    .action((session: string | undefined, opts: GetFlags, command: Command) =>
      withAuthContext(signals, (ctx) =>
        handleAgentGet(
          ctx,
          {
            follow: opts.follow,
            session: opts.session,
            sessionArgument: session,
            timeout: opts.timeout,
            workspaceId: opts.workspaceId,
          },
          agentDeps(ctx),
        ),
      )(opts, command),
    );
}
