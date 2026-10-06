import { visibleLength } from "~/core/ansi.js";

import { renderListCards } from "./renderListCards.js";
import { renderListTable, type FlowsListRow } from "./renderListTable.js";

export function renderFlowsList(
  rows: readonly FlowsListRow[],
  options: { styled: boolean; columns: number | undefined },
): string {
  const table = renderListTable(rows, options.styled, "full");
  // Unknown width means piped output or no terminal: reflowing for a width we
  // are guessing at would only surprise whoever reads it.
  if (options.columns === undefined) return table;

  const widest = Math.max(0, ...table.split("\n").map(visibleLength));
  // A table only reads well while each row is one line. Wrapping its cells
  // staggers every column; cards read top to bottom and keep each value whole.
  return widest <= options.columns
    ? table
    : renderListCards(rows, {
        styled: options.styled,
        width: options.columns,
      });
}
