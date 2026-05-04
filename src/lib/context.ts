import type { Command } from "commander";

import { errorMessage } from "./errors.js";
import { getConfigDir } from "./paths.js";
import { type OutputFlags } from "./ui/env.js";
import { type UI, createUI } from "./ui/index.js";

export type CommandContext = {
  readonly ui: UI;
  readonly configDir: string;
};

type CommandError = {
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
    try {
      const result = await fn({ ui, configDir });
      if (result !== undefined) process.exitCode = 1;
    } catch (err: unknown) {
      ui.error(errorMessage(err));
      process.exitCode = 1;
    }
  };
}
