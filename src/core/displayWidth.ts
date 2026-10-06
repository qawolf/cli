import { stripVTControlCharacters } from "node:util";
import stringWidth from "fast-string-width";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const escapeSequence =
  // oxlint-disable-next-line no-control-regex
  /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\))/g;

export const displayWidth = (text: string): number => stringWidth(text);

function styledSlice(
  text: string,
  start: number,
  end: number,
  keepEnd: boolean,
): string {
  let output = keepEnd ? "…" : "";
  let offset = 0;
  let cursor = 0;
  let ended = false;
  const append = (part: string): void => {
    const from = Math.max(0, start - offset);
    const to = Math.max(0, Math.min(part.length, end - offset));
    output += part.slice(from, to);
    offset += part.length;
    if (!keepEnd && !ended && offset >= end) {
      output += "…";
      ended = true;
    }
  };
  // Keep escape sequences outside the slice too: their resets close styles
  // opened before the clipping boundary, including styles around the cursor.
  for (const match of text.matchAll(escapeSequence)) {
    append(text.slice(cursor, match.index));
    output += match[0];
    cursor = match.index + match[0].length;
  }
  append(text.slice(cursor));
  return output;
}

export function clipColumns(
  text: string,
  width: number,
  keepEnd = false,
): string {
  if (width <= 0) return "";
  if (displayWidth(text) <= width) return text;
  const plain = stripVTControlCharacters(text);
  const segments = [...segmenter.segment(plain)];
  if (keepEnd) segments.reverse();
  let used = 0;
  let length = 0;
  for (const { segment } of segments) {
    used += displayWidth(segment);
    if (used > width - 1) break;
    length += segment.length;
  }
  return styledSlice(
    text,
    keepEnd ? plain.length - length : 0,
    keepEnd ? plain.length : length,
    keepEnd,
  );
}

export const padColumns = (text: string, width: number): string =>
  `${text}${" ".repeat(Math.max(0, width - displayWidth(text)))}`;
