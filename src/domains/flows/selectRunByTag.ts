import {
  hasSelectors,
  matchesSelectors,
  type FlowSelectors,
} from "~/core/flowSelectors.js";
import type { CommandResult } from "~/shell/commandContext.js";

import { explainEmptySelection } from "./explainEmptySelection.js";
import { tagsNotCachedResult } from "./selectorGuards.js";

export type SelectRunByTagResult =
  | { ok: true; files: string[] }
  | { ok: false; result: CommandResult };

/**
 * Narrows a run to flows carrying the selected tags, using the tags cached by
 * the last pull.
 *
 * `noMatch` builds the empty-selection result, so the caller decides whether
 * --allow-no-match downgrades it.
 */
export async function selectRunByTag(args: {
  files: string[];
  selectors: FlowSelectors;
  /**
   * Decides which environment to act on when a selection spans several.
   * Returns the files to run, or the result the caller should return instead.
   */
  chooseEnv: (
    files: string[],
  ) => Promise<{ proceed: string[] } | { stop: CommandResult }>;
  readCachedTags: (
    files: readonly string[],
  ) => Promise<Map<string, readonly string[]>>;
  /** Turns an empty selection into a result the caller wants to return. */
  noMatch: (error: string) => CommandResult;
}): Promise<SelectRunByTagResult> {
  if (!hasSelectors(args.selectors)) return { ok: true, files: args.files };

  const cachedTags = await args.readCachedTags(args.files);
  const notCached = tagsNotCachedResult(args.selectors, cachedTags);
  if (notCached !== undefined) return { ok: false, result: notCached };

  const matched = args.files.filter((file) =>
    matchesSelectors({ tags: cachedTags.get(file) }, args.selectors),
  );
  if (matched.length === 0) {
    return {
      ok: false,
      result: args.noMatch(explainEmptySelection(args.selectors)),
    };
  }

  // Each pulled env has its own variables, so the same file pulled twice is
  // two different runs; ask rather than guess which was meant.
  const choice = await args.chooseEnv(matched);
  return "proceed" in choice
    ? { ok: true, files: choice.proceed }
    : { ok: false, result: choice.stop };
}
