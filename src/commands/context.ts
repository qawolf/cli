import type { Command } from "commander";
import { errorMessage } from "~/core/errors.js";
import { getConfigDir } from "~/core/paths.js";
import {
  type OutputFlags,
  detectOutputMode,
  isInteractive,
} from "~/shell/ui/env.js";
import { createUI } from "~/shell/ui/index.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";

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
        apiBaseUrl:
          env["QAWOLF_API_URL"]?.replace(/\/+$/, "") ||
          "https://app.qawolf.com",
      });
      if (result !== undefined) {
        ui.error(result.error);
        process.exitCode = result.exitCode ?? 1;
      }
    } catch (err: unknown) {
      ui.error(errorMessage(err));
      process.exitCode = 1;
    }
  };
}
