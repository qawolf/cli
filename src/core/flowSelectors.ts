/** Tag names a command was asked to select on. */
export type FlowSelectors = {
  readonly tags: readonly string[];
};

type SelectableFlow = {
  // Undefined means the tags could not be determined, which is never the same
  // as a flow that is known to carry none.
  readonly tags: readonly string[] | undefined;
};

export function hasSelectors(selectors: FlowSelectors): boolean {
  return selectors.tags.length > 0;
}

/**
 * Tests a flow against the selectors: any of the named tags matches.
 *
 * Comparison is exact. Near misses are surfaced as suggestions when nothing
 * matches, never by loosening the match itself.
 */
export function matchesSelectors(
  flow: SelectableFlow,
  selectors: FlowSelectors,
): boolean {
  if (selectors.tags.length === 0) return true;
  return selectors.tags.some((tag) => flow.tags?.includes(tag));
}
