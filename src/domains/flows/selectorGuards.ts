import { hasSelectors, type FlowSelectors } from "~/core/flowSelectors.js";
import { flowsMessages } from "~/core/messages/index.js";
import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

import { explainEmptySelection } from "./explainEmptySelection.js";

/**
 * Guard results shared by every command that filters flows by selector — run
 * and list, local and remote. The matching itself lives in
 * `core/flowSelectors`; this module owns how a selection that cannot proceed
 * is reported, so a new selector kind changes the story in one place.
 */

/**
 * Nothing cached means every flow's tags are unknown, so filtering would match
 * nothing and read as "no flow carries that tag".
 */
export function tagsNotCachedResult(
  selectors: FlowSelectors,
  cachedTags: ReadonlyMap<string, readonly string[]>,
): CommandResult | undefined {
  if (!hasSelectors(selectors) || cachedTags.size > 0) return undefined;
  return {
    error: flowsMessages.selectors.tagsNotCached,
    exitCode: exitCodes.network,
  };
}

/** The platform is unreachable and the env's pull never cached any tags. */
export function tagsUnavailableResult(envId: string): CommandResult {
  return {
    error: flowsMessages.selectors.tagsUnavailable(envId),
    exitCode: exitCodes.network,
  };
}

/**
 * An explicit selector that matches nothing is a mistake worth reporting, not
 * an empty listing: exiting 0 would read as "there are none".
 *
 * `fetchKnownTags` is consulted only on that failing path, so the happy path
 * never pays for the call. Pass undefined when there is no platform to ask —
 * a miss is then reported as a miss, never as a typo.
 */
export async function emptySelectionResult(
  selectors: FlowSelectors,
  matched: number,
  fetchKnownTags: (() => Promise<string[] | undefined>) | undefined,
): Promise<CommandResult | undefined> {
  if (matched > 0 || !hasSelectors(selectors)) return undefined;
  return {
    error: explainEmptySelection(selectors, await fetchKnownTags?.()),
    exitCode: exitCodes.invalidArgs,
  };
}
