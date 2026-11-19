import type { Command } from "commander";

import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerSlackPostCommand } from "./post.register.js";

export function registerSlackCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const slack = program
    .command("slack")
    .description("Post in the workspace's Slack channels from a loop");

  registerSlackPostCommand(slack, signals);
}
