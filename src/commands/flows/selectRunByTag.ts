import {
  hasSelectors,
  matchesSelectors,
  type FlowSelectors,
} from "~/core/flowSelectors.js";
import { flowsMessages, runnerMessages } from "~/core/messages/index.js";
import { explainEmptySelection } from "~/domains/flows/explainEmptySelection.js";
import { noMatchResult } from "~/domains/runner/noMatch.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

/**
 * Narrows the run to flows carrying the selected tags, using the tags cached
 * by the last pull. Returns the files to run, or the result to return instead.
 */
export async function selectRunByTag(
  ctx: CommandContext,
  args: {
    files: string[];
    selectors: FlowSelectors;
    flags: FlowsRunFlags;
    readCachedTags: (
      files: readonly string[],
    ) => Promise<Map<string, readonly string[]>>;
  },
): Promise<string[] | CommandResult> {
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
    return noMatchResult(ctx, {
      allowNoMatch: args.flags.allowNoMatch,
      error: explainEmptySelection(args.selectors),
      notice: runnerMessages.noFlowsMatched,
    });
  }
  return matched;
}
