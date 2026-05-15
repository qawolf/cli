export function pluralize(
  count: number,
  singular: string,
  plural: string = `${singular}s`,
): string {
  return `${String(count)} ${count === 1 ? singular : plural}`;
}
