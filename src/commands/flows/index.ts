import type { Command } from "commander";

import type { SignalRegistry } from "~/shell/signals/createSignalRegistry.js";

import {
  type ListCommandDeps,
  registerFlowsListCommand,
} from "./list.register.js";
import { registerFlowsPullCommand } from "./pull.register.js";
import { registerFlowsRunCommand } from "./run.register.js";
import { registerRunWorkerCommand } from "./runWorker.register.js";
import { withResolvedEnv } from "./withResolvedEnv.js";

export function registerFlowsCommand(
  program: Command,
  signals: SignalRegistry,
  deps: ListCommandDeps = { withResolvedEnv },
): void {
  const flows = program
    .command("flows")
    .description("Manage and run QA Wolf flows");

  registerFlowsRunCommand(flows, signals);
  registerRunWorkerCommand(flows, signals);
  registerFlowsListCommand(flows, signals, deps);
  registerFlowsPullCommand(flows, signals);
}
