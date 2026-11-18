import { readStringLiteral } from "~/core/stringLiteral.js";

// Sticky, so each is a check at one position rather than a search.
const listGapRe = /\s*/y;
const listSeparatorRe = /\s*,\s*/y;

/**
 * Reads the array of string literals opening at `start`. Undefined when any
 * entry is not a string literal, since its value is only known at runtime.
 */
export function readStringList(
  source: string,
  start: number,
): string[] | undefined {
  const values: string[] = [];
  listGapRe.lastIndex = start + 1;
  listGapRe.test(source);
  let i = listGapRe.lastIndex;
  while (source.charAt(i) !== "]") {
    const literal = readStringLiteral(source, i);
    if (!literal) return undefined;
    values.push(literal.value);
    listSeparatorRe.lastIndex = literal.end + 1;
    if (listSeparatorRe.test(source)) {
      i = listSeparatorRe.lastIndex;
      continue;
    }
    listGapRe.lastIndex = literal.end + 1;
    listGapRe.test(source);
    i = listGapRe.lastIndex;
    if (source.charAt(i) !== "]") return undefined;
  }
  return values.length > 0 ? values : undefined;
}
