import type { Command } from "commander";

import { unavailableView, type ListView } from "~/domains/flows/listView.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import {
  detectOutputMode,
  isInteractive,
  type OutputFlags,
} from "~/shell/ui/env.js";

/**
 * Terminal access belongs in the command layer. Domains receive the chosen
 * view and the context's input-interactivity check.
 */
export function terminalListView(
  interactive: boolean | undefined,
  ctx: Pick<CommandContext, "isInteractive" | "ui">,
): ListView {
  return {
    get columns() {
      return process.stdout.columns;
    },
    interactive: interactive ?? (ctx.isInteractive && ctx.ui.mode === "human"),
  };
}

export function unavailableTerminalList(
  interactive: boolean | undefined,
  command: Command,
): CommandResult | undefined {
  if (interactive !== true) return undefined;
  // Run before withResolvedEnv: invalid terminal flags must not trigger auth
  // or an environment lookup. These are the same checks buildBaseContext uses.
  const env = process.env;
  return unavailableView(
    {
      ui: {
        mode: detectOutputMode({
          flags: command.optsWithGlobals<OutputFlags>(),
          env,
          stdoutIsTTY: Boolean(process.stdout.isTTY),
        }),
      },
      isInteractive: isInteractive({
        stdinIsTTY: Boolean(process.stdin.isTTY),
        env,
      }),
    },
    { columns: process.stdout.columns, interactive: true },
  );
}
