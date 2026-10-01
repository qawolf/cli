import { flowsMessages, runnerMessages } from "~/core/messages/index.js";
import type { CommandResult } from "~/shell/commandContext.js";
import type { UI } from "~/shell/ui/index.js";

import { fitListTable } from "./fitListTable.js";
import type { ListView } from "./listView.js";
import { renderFlowsList } from "./renderFlowsList.js";
import { sharedPulledPrefix } from "./pulledPrefix.js";
import type { FlowsListRow } from "./renderListTable.js";

/**
 * The flow table, narrowing as the user types; the flows kept are printed.
 * Human mode only: callers check with `unavailableView` before doing any work.
 */
export async function filterFlows(
  ui: UI,
  rows: readonly FlowsListRow[],
  view: Pick<ListView, "columns">,
  options: { readonly title?: string } = {},
): Promise<CommandResult> {
  if (rows.length === 0) {
    ui.info(runnerMessages.noFlowsMatched);
    return;
  }

  ui.gap();
  ui.intro(options.title ?? flowsMessages.title);
  const result = await ui.filterList({
    message: flowsMessages.list.filterFlows(sharedPulledPrefix(rows)),
    items: rows,
    // Search includes tags hidden by column truncation.
    searchText: (row) => [
      row.name,
      row.file,
      row.target,
      row.env,
      ...(row.tags ?? []),
    ],
    table: fitListTable,
    describeCount: flowsMessages.list.filterCount,
    // The highlighted flow in full: the table may have cut its path.
    detail: (row) =>
      `${row.flowId ?? flowsMessages.list.noFlowIdShort}  ·  ${row.file}`,
  });
  if (!result.ok) return;
  if (result.value.length === 0) {
    ui.info(runnerMessages.noFlowsMatched);
    return;
  }

  // Printed in full: the live table cuts cells to keep each flow on one line.
  ui.write(
    renderFlowsList(result.value, { styled: true, columns: view.columns }),
  );
  ui.outro(flowsMessages.flowCount(result.value.length));
}
