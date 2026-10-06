import { stripVTControlCharacters } from "node:util";

export function singleLine(text: string): string {
  return (
    text
      // Preserve SGR styling while removing terminal commands and line controls.
      // oxlint-disable-next-line no-control-regex
      .split(/(\x1b\[[\d;:]*m)/g)
      .map((part, index) =>
        index % 2 === 1
          ? part
          : stripVTControlCharacters(part).replace(
              /[\p{Control}\p{Line_Separator}\p{Paragraph_Separator}]+/gu,
              " ",
            ),
      )
      .join("")
  );
}
