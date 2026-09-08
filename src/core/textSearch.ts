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
