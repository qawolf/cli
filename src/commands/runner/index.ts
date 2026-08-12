import type { Command } from "commander";

import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerRunnerInteractCommands } from "./interact.register.js";
import { registerRunnerLifecycleCommands } from "./lifecycle.register.js";
import { registerRunnerRunCommands } from "./run.register.js";

export function registerRunnerCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const runner = program
    .command("runner")
    .description("Drive an interactive runner on the QA Wolf platform");

  registerRunnerLifecycleCommands(runner, signals);
  registerRunnerRunCommands(runner, signals);
  registerRunnerInteractCommands(runner, signals);
}
