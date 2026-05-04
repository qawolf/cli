import type { Command } from "commander";

import { errorMessage } from "./errors.js";
import { getConfigDir } from "./paths.js";
import { getApiBaseUrl } from "./config.js";
import {
  type OutputFlags,
  type OutputMode,
  detectOutputMode,
  isCI,
} from "./ui/env.js";
import { type UI, createUI } from "./ui/index.js";

export type CommandContext = {
  readonly ui: UI;
  readonly configDir: string;
  readonly outputMode: OutputMode;
  readonly isInteractive: boolean;
  readonly apiBaseUrl: string;
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
    const outputMode = detectOutputMode(
      command.optsWithGlobals<OutputFlags>(),
      process.env,
      process.stdout.isTTY,
    );
    const ui = createUI(outputMode);
    try {
      const result = await fn({
        ui,
        configDir: getConfigDir(),
        outputMode,
        isInteractive: Boolean(process.stdin.isTTY) && !isCI(process.env),
        apiBaseUrl: getApiBaseUrl(process.env),
      });
      if (result !== undefined) process.exitCode = 1;
    } catch (err: unknown) {
      ui.error(errorMessage(err));
      process.exitCode = 1;
    }
  };
}
