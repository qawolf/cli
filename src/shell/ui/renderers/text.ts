import type { StyledClack } from "~/shell/ui/clack/index.js";
import type { OutputMode } from "~/shell/ui/env.js";
import { assertHumanMode } from "./assertHumanMode.js";
import type { PromptResult } from "./types.js";

type TextDeps = { mode: OutputMode; clack: StyledClack };

export type TextFn = (message: string) => Promise<PromptResult<string>>;

/**
 * A free-text answer.
 *
 * The prompt for a question with no fixed set of answers, where `select` covers
 * the ones that have them. The empty string comes back as a cancel rather than
 * an answer: clack resolves an untouched prompt to it, and a caller sending it
 * on as an answer would tell the reader something it cannot act on.
 */
export function createText({ mode, clack }: TextDeps): TextFn {
  return async (message) => {
    assertHumanMode(mode, "text");
    const value = await clack.text({ message });
    if (clack.isCancel(value)) return { ok: false };
    const answer = value.trim();
    if (answer.length === 0) return { ok: false };
    return { ok: true, value: answer };
  };
}
