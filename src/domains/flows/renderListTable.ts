import { type TableColumn, renderTable } from "~/core/renderTable.js";

export type FlowsListRow = {
  readonly name: string;
  readonly target: string;
  readonly file: string;
  // Undefined when the caller cannot determine the tags, as opposed to a flow
  // that is genuinely untagged.
  readonly tags: readonly string[] | undefined;
};

const nameColumn: TableColumn<FlowsListRow> = {
  header: "name",
  value: (row) => row.name,
};
const targetColumn: TableColumn<FlowsListRow> = {
  header: "target",
  value: (row) => row.target,
};
const tagsColumn: TableColumn<FlowsListRow> = {
  header: "tags",
  value: (row) => (row.tags ?? []).join(", "),
};
// Last, because it holds the widest cell.
const fileColumn: TableColumn<FlowsListRow> = {
  header: "file",
  value: (row) => row.file,
};

export function renderListTable(
  rows: readonly FlowsListRow[],
  boldHeader: boolean,
): string {
  // Tagging is sparse, and local flows that were never pulled have no tags to
  // report at all, so the column only appears once some row can fill it.
  const someTagged = rows.some((row) => (row.tags ?? []).length > 0);
  const columns = [
    nameColumn,
    targetColumn,
    ...(someTagged ? [tagsColumn] : []),
    fileColumn,
  ];
  return renderTable({ boldHeader, columns, rows });
}
