export type FlowsListRow = {
  readonly name: string;
  readonly target: string;
  readonly file: string;
};

const columns = ["name", "target", "file"] as const;
type Column = (typeof columns)[number];

const ansiBold = "\x1b[1m";
const ansiReset = "\x1b[0m";

export function renderListTable(
  rows: readonly FlowsListRow[],
  boldHeader: boolean,
): string {
  const widths: Record<Column, number> = {
    name: Math.max("name".length, ...rows.map((r) => r.name.length)),
    target: Math.max("target".length, ...rows.map((r) => r.target.length)),
    file: Math.max("file".length, ...rows.map((r) => r.file.length)),
  };
  const header: Record<Column, string> = {
    name: "name",
    target: "target",
    file: "file",
  };
  const renderRow = (cells: Record<Column, string>): string =>
    columns
      .map((c) => cells[c].padEnd(widths[c]))
      .join("  ")
      .trimEnd();
  const headerLine = boldHeader
    ? `${ansiBold}${renderRow(header)}${ansiReset}`
    : renderRow(header);
  return [headerLine, ...rows.map(renderRow)].join("\n") + "\n";
}
