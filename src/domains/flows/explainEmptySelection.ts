import type { FlowSelectors } from "~/core/flowSelectors.js";
import { flowsMessages } from "~/core/messages/index.js";
import { suggestNearMiss } from "~/core/suggestNearMiss.js";
/**
 * Explains why an explicit tag selector matched no flows, as a message the
 * caller turns into a result — `flows run` routes it through noMatchResult so
 * --allow-no-match applies, while `flows list` has no such flag.
 *
 * `knownTags` is the team's tag list. Omit it when it could not be fetched:
 * tags are team-scoped, so a tag missing from an environment's flows may still
 * be real, and calling it unknown on that evidence would be wrong.
 */
export function explainEmptySelection(
  selectors: FlowSelectors,
  knownTags?: readonly string[],
): string {
  if (knownTags !== undefined) {
    const unknownTag = selectors.tags.find((tag) => !knownTags.includes(tag));
    if (unknownTag !== undefined) {
      return flowsMessages.selectors.unknownTag(
        unknownTag,
        suggestNearMiss(unknownTag, knownTags),
      );
    }
  }

  return flowsMessages.selectors.noFlowsSelected(selectors);
}
