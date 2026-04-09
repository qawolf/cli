import type { Command } from "commander";

import { type OutputFlags, type UIContext, createUI } from "./ui/index.js";

type UIAction = (ui: UIContext, command: Command) => Promise<void>;

export function withUI(
  fn: UIAction,
): (opts: unknown, command: Command) => Promise<void> {
  return async (_opts: unknown, command: Command): Promise<void> => {
    const ui = createUI(command.optsWithGlobals<OutputFlags>());
    await fn(ui, command);
  };
}
