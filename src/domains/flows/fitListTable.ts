import { dim } from "~/core/ansi.js";
import { clipColumns, displayWidth, padColumns } from "~/core/displayWidth.js";

import { sharedPulledPrefix, withoutPulledPrefix } from "./pulledPrefix.js";
import { listTableColumns, type FlowsListRow } from "./renderListTable.js";

const gap = "  ";

const quietColumns = new Set(["target", "tags"]);

function styleCell(header: string, text: string): string {
  if (header === "file") {
    // The folder is shared context; the file name is what tells rows apart.
    const cut = Math.max(text.lastIndexOf("/"), text.lastIndexOf("\\")) + 1;
    return `${dim(text.slice(0, cut))}${text.slice(cut)}`;
  }
  return quietColumns.has(header) ? dim(text) : text;
}

// Takes a character at a time from whichever column is widest, so a long path
// or tag list gives way before a short name does.
function shrinkToFit(
  natural: readonly number[],
  minimums: readonly number[],
  budget: number,
): number[] {
  const widths = [...natural];
  let total = widths.reduce((sum, width) => sum + width, 0);
  while (total > budget) {
    let widest = -1;
    widths.forEach((width, index) => {
      if (width <= (minimums[index] ?? 0)) return;
      if (widest === -1 || width > (widths[widest] ?? 0)) widest = index;
    });
    if (widest === -1) break;
    widths[widest] = (widths[widest] ?? 0) - 1;
    total -= 1;
  }
  return widths;
}

/**
 * The flow list as exactly one line per flow within `width`. Cells that do not
 * fit are cut and end in "…"; lines carry styling, the header does not.
 */
export function fitListTable(
  rows: readonly FlowsListRow[],
  width: number,
): { header: string; line: (row: FlowsListRow) => string } {
  // The shared `.qawolf/<env>/` prefix says the same thing on every row.
  const prefix = sharedPulledPrefix(rows);
  const shorten = (row: FlowsListRow): FlowsListRow => ({
    ...row,
    file: withoutPulledPrefix(row.file, prefix),
  });

  const columns = listTableColumns(rows);
  // Keep the leftmost identifying columns when full headings no longer fit.
  while (
    columns.length > 1 &&
    columns.reduce((sum, column) => sum + displayWidth(column.header), 0) +
      gap.length * (columns.length - 1) >
      width
  )
    columns.pop();
  const natural = columns.map((column) =>
    Math.max(
      displayWidth(column.header),
      ...rows.map((row) => displayWidth(column.value(shorten(row)))),
    ),
  );
  const widths = shrinkToFit(
    natural,
    columns.map((column) => displayWidth(column.header)),
    width - gap.length * (columns.length - 1),
  );

  const join = (cells: string[]): string =>
    clipColumns(cells.join(gap).trimEnd(), width);
  const cell = (text: string, room: number, keepEnd: boolean): string =>
    padColumns(clipColumns(text, room, keepEnd), room);
  return {
    header: join(
      columns.map((column, index) =>
        cell(column.header, widths[index] ?? 0, false),
      ),
    ),
    line: (row) =>
      join(
        columns.map((column, index) =>
          styleCell(
            column.header,
            cell(
              column.value(shorten(row)),
              widths[index] ?? 0,
              column.header === "file",
            ),
          ),
        ),
      ),
  };
}
