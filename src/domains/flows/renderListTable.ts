import { type TableColumn, renderTable } from "~/core/renderTable.js";

export type FlowsListRow = {
  readonly name: string;
  readonly target: string;
  readonly file: string;
  // The pulled environment a flow came from, undefined for project flows.
  readonly env: string | undefined;
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
const envColumn: TableColumn<FlowsListRow> = {
  header: "env",
  value: (row) => row.env ?? "",
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
  // One source puts the same value on every row; the column only earns its
  // place when it tells rows apart. A project flow counts as its own source,
  // so a listing mixing local and pulled rows still shows it.
  const severalEnvs = new Set(rows.map((row) => row.env)).size > 1;
  const columns = [
    nameColumn,
    targetColumn,
    ...(severalEnvs ? [envColumn] : []),
    ...(someTagged ? [tagsColumn] : []),
    fileColumn,
  ];
  return renderTable({ boldHeader, columns, rows });
}
