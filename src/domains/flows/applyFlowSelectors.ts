import { hasSelectors, type FlowSelectors } from "~/core/flowSelectors.js";
import { flowsMessages } from "~/core/messages/index.js";
import { selectFlowFiles } from "~/core/selectFlowFiles.js";
import type { CommandResult } from "~/shell/commandContext.js";

import { explainEmptySelection } from "./explainEmptySelection.js";
import type { TagResolution } from "./resolveTags.js";
import { tagsUnavailableResult } from "./selectorGuards.js";

type Args = {
  readonly files: readonly string[];
  readonly cwd: string;
  readonly selectors: FlowSelectors;
  readonly warn: (message: string) => void;
  readonly resolveTags: () => Promise<TagResolution>;
  readonly fetchKnownTags: () => Promise<string[] | undefined>;
  /**
   * Turns an empty selection into a result. `flows run` routes this through
   * noMatchResult so --allow-no-match downgrades it to a clean exit.
   */
  readonly onEmpty: (error: string) => CommandResult;
  readonly envId: string;
};

export type ApplyFlowSelectorsResult =
  | { ok: true; files: string[] }
  | { ok: false; result: CommandResult };

/**
 * Narrows flow files by tag, resolving them only when a tag selector was
 * actually given.
 *
 * A selector that matches nothing fails rather than running zero flows: the
 * caller asked for something specific, and an empty run is indistinguishable
 * from a successful one once it has finished.
 */
export async function applyFlowSelectors(
  args: Args,
): Promise<ApplyFlowSelectorsResult> {
  if (!hasSelectors(args.selectors)) {
    return { ok: true, files: [...args.files] };
  }

  const resolution = await args.resolveTags();
  if (resolution.kind === "unavailable") {
    return { ok: false, result: tagsUnavailableResult(args.envId) };
  }
  if (resolution.kind === "cached") {
    args.warn(flowsMessages.selectors.usingCachedTags(resolution.fetchedAt));
  }

  const selection = selectFlowFiles({
    files: args.files,
    cwd: args.cwd,
    selectors: args.selectors,
    tagsByPath: resolution.byPath,
  });
  if (selection.kind === "selected") {
    return { ok: true, files: selection.files };
  }

  // Consulted only now that something has already failed to match, so the
  // happy path never pays for this call.
  return {
    ok: false,
    result: args.onEmpty(
      explainEmptySelection(args.selectors, await args.fetchKnownTags()),
    ),
  };
}
