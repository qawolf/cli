import { hasSelectors, type FlowSelectors } from "~/core/flowSelectors.js";
import { flowsMessages } from "~/core/messages/index.js";
import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import { explainEmptySelection } from "./explainEmptySelection.js";

/**
 * Nothing cached means every flow's tags are unknown, so filtering would match
 * nothing and read as "no flow carries that tag".
 */
export function tagsUnavailableResult(
  selectors: FlowSelectors,
  cachedTags: ReadonlyMap<string, readonly string[]>,
): CommandResult | undefined {
  if (!hasSelectors(selectors) || cachedTags.size > 0) return undefined;
  return {
    error: flowsMessages.selectors.tagsNotCached,
    exitCode: exitCodes.network,
  };
}

/**
 * There is no team tag list offline, so a miss is reported as a miss and never
 * as a typo — absence here is not proof the tag does not exist.
 */
export function emptySelectionResult(
  selectors: FlowSelectors,
  matched: number,
): CommandResult | undefined {
  if (matched > 0 || !hasSelectors(selectors)) return undefined;
  return {
    error: explainEmptySelection(selectors),
    exitCode: exitCodes.invalidArgs,
  };
}
