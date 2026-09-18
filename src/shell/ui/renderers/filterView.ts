import type { Writable } from "node:stream";
import { getColumns, getRows } from "@clack/core";

import { displayWidth } from "~/core/displayWidth.js";

import {
  type FilterFrame,
  frameGutter,
  renderFilterFrame,
} from "./filterFrame.js";
import type { FilterListArgs, FilterTable } from "./types.js";

export type PromptView<Item> = {
  readonly state: FilterFrame["state"];
  readonly userInput: string;
  readonly userInputWithCursor: string;
  readonly filteredOptions: readonly {
    readonly value: number;
    readonly item: Item;
  }[];
  readonly cursor: number;
};

export function createFrameDrawer<Item>(
  args: FilterListArgs<Item>,
  output: Writable,
): (view: PromptView<Item>, state?: FilterFrame["state"]) => string {
  // Laid out from every item rather than the current matches, so columns
  // hold still while the list narrows. Redone only on a resize.
  const cached = new Map<number, string>();
  let layout: { width: number; table: FilterTable<Item> } | undefined;
  const tableFor = (width: number): FilterTable<Item> => {
    if (layout === undefined || layout.width !== width) {
      layout = { width, table: args.table(args.items, width) };
      cached.clear();
    }
    return layout.table;
  };

  return (view, state = view.state) => {
    const columns = getColumns(output);
    const table = tableFor(Math.max(0, columns - displayWidth(frameGutter)));
    const highlighted = view.filteredOptions[view.cursor];
    return renderFilterFrame({
      state,
      message: args.message,
      search: view.userInput,
      searchWithCursor: view.userInputWithCursor,
      header: table.header,
      rowCount: view.filteredOptions.length,
      line: (index) => {
        const option = view.filteredOptions[index];
        if (option === undefined) return "";
        let line = cached.get(option.value);
        if (line === undefined) {
          line = table.line(option.item);
          cached.set(option.value, line);
        }
        return line;
      },
      focus: view.cursor,
      detail:
        highlighted === undefined ? undefined : args.detail(highlighted.item),
      columns,
      terminalRows: getRows(output),
      count: args.describeCount(view.filteredOptions.length, args.items.length),
    });
  };
}
