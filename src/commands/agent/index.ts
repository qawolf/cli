import type { Command } from "commander";

import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerAgentGetCommand } from "./get.register.js";
import { registerAgentSendCommand } from "./send.register.js";

export function registerAgentCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const agent = program
    .command("agent")
    .description("Ask the QA Wolf AI for work and follow what it does");

  registerAgentSendCommand(agent, signals);
  registerAgentGetCommand(agent, signals);
}
