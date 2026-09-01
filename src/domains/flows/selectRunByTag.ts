import {
  hasSelectors,
  matchesSelectors,
  type FlowSelectors,
} from "~/core/flowSelectors.js";
import { flowsMessages } from "~/core/messages/index.js";
import { explainEmptySelection } from "./explainEmptySelection.js";
import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

/**
 * Narrows a run to flows carrying the selected tags, using the tags cached by
 * the last pull. Returns the files to run, or the result to return instead.
 *
 * `noMatch` builds the empty-selection result, so the caller decides whether
 * --allow-no-match downgrades it.
 */
export async function selectRunByTag(args: {
  files: string[];
  selectors: FlowSelectors;
  readCachedTags: (
    files: readonly string[],
  ) => Promise<Map<string, readonly string[]>>;
  /** Turns an empty selection into a result the caller wants to return. */
  noMatch: (error: string) => CommandResult;
}): Promise<string[] | CommandResult> {
  if (!hasSelectors(args.selectors)) return args.files;

  const cachedTags = await args.readCachedTags(args.files);
  // Nothing cached means every flow's tags are unknown, so filtering would
  // match nothing and look like "no flow carries that tag".
  if (cachedTags.size === 0) {
    return {
      error: flowsMessages.selectors.tagsNotCached,
      exitCode: exitCodes.network,
    };
  }

  const matched = args.files.filter((file) =>
    matchesSelectors({ tags: cachedTags.get(file) }, args.selectors),
  );
  if (matched.length === 0) {
    return args.noMatch(explainEmptySelection(args.selectors));
  }
  return matched;
}
