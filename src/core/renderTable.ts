import { displayWidth, padColumns } from "./displayWidth.js";

export type TableColumn<Row> = {
  readonly header: string;
  readonly value: (row: Row) => string;
};

const ansiBold = "\x1b[1m";
const ansiReset = "\x1b[0m";

export function renderTable<Row>(options: {
  boldHeader: boolean;
  columns: readonly TableColumn<Row>[];
  rows: readonly Row[];
}): string {
  const { boldHeader, columns, rows } = options;
  const measured = columns.map((column) => ({
    column,
    width: Math.max(
      displayWidth(column.header),
      ...rows.map((row) => displayWidth(column.value(row))),
    ),
  }));

  const renderRow = (cell: (column: TableColumn<Row>) => string): string =>
    measured
      .map(({ column, width }) => padColumns(cell(column), width))
      .join("  ")
      .trimEnd();

  const header = renderRow((column) => column.header);
  return (
    [
      boldHeader ? `${ansiBold}${header}${ansiReset}` : header,
      ...rows.map((row) => renderRow((column) => column.value(row))),
    ].join("\n") + "\n"
  );
}
