import { PassThrough } from "node:stream";
import { expect, it, mock } from "bun:test";

import { createFrameDrawer } from "./filterView.js";

it("formats only visible rows and reuses them until width changes", () => {
  const output = Object.assign(new PassThrough(), { columns: 80, rows: 12 });
  const items = Array.from({ length: 1000 }, (_, index) => String(index));
  const line = mock((item: string) => item);
  const table = mock(() => ({ header: "name", line }));
  const draw = createFrameDrawer(
    {
      message: "Filter",
      items,
      table,
      searchText: (item) => [item],
      describeCount: (matched) => String(matched),
      detail: (item) => item,
    },
    output,
  );
  const view = {
    state: "active" as const,
    userInput: "",
    userInputWithCursor: "█",
    filteredOptions: items.map((item, value) => ({ item, value })),
    cursor: 0,
  };
  draw(view);
  expect(line.mock.calls.length).toBeLessThanOrEqual(output.rows);
  const first = line.mock.calls.length;
  draw({ ...view, cursor: 1 });
  expect(line.mock.calls.length).toBe(first);
  output.columns = 60;
  draw(view);
  expect(table).toHaveBeenCalledTimes(2);
  expect(line.mock.calls.length).toBe(first * 2);
});
