import type { OutputMode } from "../env.js";

export function assertHumanMode(
  mode: OutputMode,
  method: string,
): asserts mode is "human" {
  if (mode !== "human") {
    throw new Error(
      `ctx.${method}() requires human mode (current: ${mode}). ` +
        `This is a bug — the caller should check ctx.mode first.`,
    );
  }
}
