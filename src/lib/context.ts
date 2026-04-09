import type { Command } from "commander";

import { getConfigDir } from "./paths.js";
import { type OutputFlags, type UIContext, createUI } from "./ui/index.js";

export type CommandContext = {
  readonly ui: UIContext;
  readonly configDir: string;
};

export type CommandError = {
  readonly error: string;
};

export type CommandResult = CommandError | void;

type ContextAction = (ctx: CommandContext) => Promise<CommandResult>;

export function withContext(
  fn: ContextAction,
): (opts: unknown, command: Command) => Promise<void> {
  return async (_opts: unknown, command: Command): Promise<void> => {
    const ui = createUI(command.optsWithGlobals<OutputFlags>());
    const configDir = getConfigDir();
    const result = await fn({ ui, configDir });
    if (result !== undefined) process.exitCode = 1;
  };
}
