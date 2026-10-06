const guideWidth = 80;

function wrapWords(
  text: string,
  firstPrefix: string,
  restPrefix: string,
): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  return words.reduce<string[]>((lines, word) => {
    const last = lines.at(-1);
    if (last === undefined) return [`${firstPrefix}${word}`];
    if (last.length + 1 + word.length <= guideWidth) {
      return [...lines.slice(0, -1), `${last} ${word}`];
    }
    return [...lines, `${restPrefix}${word}`];
  }, []);
}

function formatLine(line: string): string[] {
  if (line.startsWith("# ")) return [`${line.slice(2)}:`];
  if (line.startsWith("$ ")) return [`  ${line}`];
  if (line.startsWith("- ")) return wrapWords(line.slice(2), "  - ", "    ");
  return wrapWords(line, "  ", "  ");
}

/**
 * Lays out a guide written one paragraph per line in the shape the rest of
 * `--help` has: `# Title` becomes `Title:` with its section right under it,
 * `$ ` lines are commands kept as written, `- ` lines are bullets, and other
 * lines are prose wrapped to 80 columns under a two-space indent.
 */
export function formatGuide(source: string): string {
  const paragraphs = source
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.split("\n"));
  const rendered = paragraphs.map((lines, index) => {
    const text = lines.flatMap(formatLine).join("\n");
    const followsTitle = paragraphs[index - 1]?.[0]?.startsWith("# ") === true;
    return index === 0 ? text : `${followsTitle ? "\n" : "\n\n"}${text}`;
  });
  return `\n${rendered.join("")}`;
}
