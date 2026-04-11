import type { OutputMode } from "../env.js";

export function assertHumanMode(
  mode: OutputMode,
  hint?: string,
): asserts mode is "human" {
  if (mode !== "human") {
    const message = hint
      ? `This command requires an interactive terminal. ${hint}`
      : "This command requires an interactive terminal.";
    throw Error(message);
  }
}
