import type { Command } from "commander";

import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerEventsCommand } from "./events.register.js";
import {
  registerLaunchCommand,
  registerStopCommand,
} from "./lifecycle.register.js";
import { registerRunCommand } from "./run.register.js";

export function registerRunnerCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const runner = program
    .command("runner")
    .description("Drive an interactive runner on the QA Wolf platform");

  registerLaunchCommand(runner, signals);
  registerStopCommand(runner, signals);
  registerRunCommand(runner, signals);
  registerEventsCommand(runner, signals);
}
