/**
 * Case and separators are presentation, not identity: an organization shown as
 * "Acme Retail" has the slug `acme-retail`, and someone who types either
 * spelling means the same thing. Collapsing both before comparing is what lets
 * a filter box, a near-miss suggestion, and a pasted slug agree on what a
 * person meant.
 */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-_\s]+/g, " ")
    .trim();
}

/**
 * Whether any of `fields` contains what was typed.
 *
 * An empty search matches everything, so clearing a filter box restores the
 * list rather than emptying it. Absent fields are skipped rather than treated
 * as an empty string, which would otherwise match every search of one space.
 */
export function matchesSearchTerm(
  search: string,
  fields: readonly (string | undefined)[],
): boolean {
  const needle = normalizeForSearch(search);
  if (!needle) return true;
  return fields.some(
    (field) =>
      field !== undefined && normalizeForSearch(field).includes(needle),
  );
}

/**
 * Builds a matcher for a list that will be filtered many times over.
 *
 * A filter box re-tests every item on every keystroke, so normalizing the same
 * fields again on each pass is the cost that shows once a list is long. This
 * normalizes each item once up front, and the search text once per keystroke
 * rather than once per item.
 */
export function createSearchIndex<Item extends object>(
  items: readonly Item[],
  fieldsOf: (item: Item) => readonly (string | undefined)[],
): (search: string, item: Item) => boolean {
  const indexed = new Map<Item, string[]>();
  for (const item of items) {
    indexed.set(
      item,
      fieldsOf(item).flatMap((field) =>
        field === undefined ? [] : [normalizeForSearch(field)],
      ),
    );
  }

  let lastSearch: string | undefined;
  let needle = "";

  return (search, item) => {
    if (search !== lastSearch) {
      lastSearch = search;
      needle = normalizeForSearch(search);
    }
    if (!needle) return true;

    const fields = indexed.get(item);
    // An item the index never saw is matched the slow way rather than
    // reported as no match, so a caller that filters a list it did not index
    // still gets the right answer.
    return fields
      ? fields.some((field) => field.includes(needle))
      : matchesSearchTerm(search, fieldsOf(item));
  };
}
