import { type TableColumn, renderTable } from "~/core/renderTable.js";

export type FlowsListRow = {
  readonly name: string;
  readonly target: string;
  readonly file: string;
};

const columns: readonly TableColumn<FlowsListRow>[] = [
  { header: "name", value: (row) => row.name },
  { header: "target", value: (row) => row.target },
  { header: "file", value: (row) => row.file },
];

export function renderListTable(
  rows: readonly FlowsListRow[],
  boldHeader: boolean,
): string {
  return renderTable({ boldHeader, columns, rows });
}
