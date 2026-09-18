import { bold as boldStyle, dim as dimStyle } from "~/core/ansi.js";
import { displayWidth } from "~/core/displayWidth.js";

import { sharedPulledPrefix, withoutPulledPrefix } from "./pulledPrefix.js";
import type { FlowsListRow } from "./renderListTable.js";

const indent = "  ";
// Keep every value aligned in the same column.
const labelWidth = 8;
const labelGap = "  ";
// Below this, wrapping helps nobody: values run on and the terminal wraps them.
const minValueWidth = 20;

// Breaks only between whole items — names in a list, segments of a path — so
// nothing is ever cut. An item wider than `width` gets a line to itself.
function wrapBetween(
  items: readonly string[],
  joiner: string,
  width: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const [index, item] of items.entries()) {
    const candidate = current === "" ? item : `${current}${joiner}${item}`;
    const suffix = index < items.length - 1 ? joiner.trimEnd() : "";
    if (displayWidth(candidate + suffix) > width && current !== "") {
      lines.push(`${current}${joiner.trimEnd()}`);
      current = item;
    } else {
      current = candidate;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

export function renderListCards(
  rows: readonly FlowsListRow[],
  options: { styled: boolean; width: number },
): string {
  const bold = (text: string): string =>
    options.styled ? boldStyle(text) : text;
  const dim = (text: string): string =>
    options.styled ? dimStyle(text) : text;

  const valueWidth = Math.max(
    minValueWidth,
    options.width - displayWidth(indent) - labelWidth - displayWidth(labelGap),
  );
  const prefix = sharedPulledPrefix(rows);
  // Same rule as the table's env column: only worth a line when rows differ.
  const severalEnvs = new Set(rows.map((row) => row.env)).size > 1;

  const out: string[] = [];
  if (prefix !== undefined) out.push(dim(`in ${prefix}`), "");

  for (const row of rows) {
    out.push(
      row.target === undefined
        ? bold(row.name)
        : `${bold(row.name)}  ${dim("·")}  ${row.target}`,
    );
    const file = withoutPulledPrefix(row.file, prefix);
    const fields: [string, readonly string[], string][] = [
      ["id", row.flowId === undefined ? [] : [row.flowId], ""],
      ["env", severalEnvs && row.env !== undefined ? [row.env] : [], ", "],
      ["tags", row.tags ?? [], ", "],
      // Split after each separator, so a Windows path keeps its own.
      ["file", file.split(/(?<=[\\/])/), ""],
    ];
    for (const [label, items, joiner] of fields) {
      if (items.length === 0) continue;
      wrapBetween(items, joiner, valueWidth).forEach((line, index) => {
        const shown = index === 0 ? label : "";
        out.push(`${indent}${dim(shown.padEnd(labelWidth))}${labelGap}${line}`);
      });
    }
    out.push("");
  }
  return out.join("\n");
}
