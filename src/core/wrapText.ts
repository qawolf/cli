function wrapLine(rawLine: string, width: number): string[] {
  // Trailing spaces would otherwise become an empty word past the width and
  // land as an empty line of their own. Markdown's two-space line break is the
  // common source, and it means nothing in a terminal.
  const line = rawLine.trimEnd();
  if (line.length <= width) return [line];
  const indent = /^\s*/.exec(line)?.[0] ?? "";
  const lines: string[] = [];
  let current = "";
  for (const word of line.trimStart().split(" ")) {
    if (current === "") {
      current = word;
    } else if (indent.length + current.length + 1 + word.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(indent + current);
      current = word;
    }
  }
  lines.push(indent + current);
  return lines;
}

/**
 * Wraps prose to a width at its spaces, keeping the line breaks it already
 * has and the indent each line opens with.
 *
 * A word longer than the width stays whole on a line of its own: a URL or a
 * path broken in two is worse than one that runs past the edge.
 */
export function wrapText(text: string, width: number): string {
  return text
    .split("\n")
    .flatMap((line) => wrapLine(line, width))
    .join("\n");
}
