import type { Command } from "commander";

import { errorMessage } from "./errors.js";
import { getConfigDir } from "./paths.js";
import { getApiBaseUrl } from "./config.js";
import {
  type OutputFlags,
  type OutputMode,
  detectOutputMode,
  isInteractive,
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
    const env = process.env;
    const outputMode = detectOutputMode({
      flags: command.optsWithGlobals<OutputFlags>(),
      env,
      stdoutIsTTY: Boolean(process.stdout.isTTY),
    });
    const ui = createUI(outputMode);
    try {
      const result = await fn({
        ui,
        configDir: getConfigDir(),
        outputMode,
        isInteractive: isInteractive({
          stdinIsTTY: Boolean(process.stdin.isTTY),
          env,
        }),
        apiBaseUrl: getApiBaseUrl(env),
      });
      if (result !== undefined) process.exitCode = 1;
    } catch (err: unknown) {
      ui.error(errorMessage(err));
      process.exitCode = 1;
    }
  };
}
