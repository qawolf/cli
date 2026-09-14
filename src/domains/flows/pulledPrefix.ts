import type { FlowsListRow } from "./renderListTable.js";

export function sharedPulledPrefix(
  rows: readonly FlowsListRow[],
): string | undefined {
  const prefixes = new Set(
    rows.map((row) => /^\.qawolf[\\/][^\\/]+[\\/]/.exec(row.file)?.[0]),
  );
  if (prefixes.size !== 1) return undefined;
  const [only] = prefixes;
  return only;
}

export const withoutPulledPrefix = (
  file: string,
  prefix: string | undefined,
): string =>
  prefix !== undefined && file.startsWith(prefix)
    ? file.slice(prefix.length)
    : file;
