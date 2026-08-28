import type { Command } from "commander";

import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import { registerRunnerHighlightSelectorCommand } from "./highlightSelector.register.js";
import { registerRunnerImportPackageCommand } from "./importPackage.register.js";
import { registerRunnerInspectCommands } from "./inspect.register.js";
import { registerRunnerInteractCommands } from "./interact.register.js";
import { registerRunnerLifecycleCommands } from "./lifecycle.register.js";
import { registerRunnerPromoteSnapshotCommand } from "./promoteSnapshot.register.js";
import { registerRunnerEventsCommand } from "./events.register.js";
import { registerRunCommand } from "./run.register.js";

export function registerRunnerCommand(
  program: Command,
  signals: SignalRegistry,
): void {
  const runner = program
    .command("runner")
    .description("Drive an interactive runner on the QA Wolf platform");

  registerRunnerLifecycleCommands(runner, signals);
  registerRunCommand(runner, signals);
  registerRunnerEventsCommand(runner, signals);
  registerRunnerInteractCommands(runner, signals);
  registerRunnerInspectCommands(runner, signals);
  registerRunnerImportPackageCommand(runner, signals);
  registerRunnerHighlightSelectorCommand(runner, signals);
  registerRunnerPromoteSnapshotCommand(runner, signals);
}
