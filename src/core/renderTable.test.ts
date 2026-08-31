import { describe, expect, it } from "bun:test";

import { type TableColumn, renderTable } from "./renderTable.js";

type Runner = { id: string; family: string };

const columns: readonly TableColumn<Runner>[] = [
  { header: "id", value: (row) => row.id },
  { header: "family", value: (row) => row.family },
];

describe("renderTable", () => {
  it("pads every column to its widest cell and trims the last one", () => {
    const table = renderTable({
      boldHeader: false,
      columns,
      rows: [
        { family: "playwright", id: "cli-a" },
        { family: "android", id: "cli-longer-id" },
      ],
    });

    expect(table).toBe(
      [
        "id             family",
        "cli-a          playwright",
        "cli-longer-id  android",
        "",
      ].join("\n"),
    );
  });

  it("widens a column to fit its header when every cell is shorter", () => {
    const table = renderTable({
      boldHeader: false,
      columns,
      rows: [{ family: "web", id: "a" }],
    });

    expect(table).toBe(["id  family", "a   web", ""].join("\n"));
  });

  it("wraps only the header when asked to bold it", () => {
    const table = renderTable({
      boldHeader: true,
      columns,
      rows: [{ family: "web", id: "a" }],
    });

    expect(table).toBe(["\x1b[1mid  family\x1b[0m", "a   web", ""].join("\n"));
  });

  it("renders the header alone when there are no rows", () => {
    const table = renderTable({ boldHeader: false, columns, rows: [] });

    expect(table).toBe("id  family\n");
  });
});
