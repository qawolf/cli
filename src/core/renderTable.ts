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
      column.header.length,
      ...rows.map((row) => column.value(row).length),
    ),
  }));

  const renderRow = (cell: (column: TableColumn<Row>) => string): string =>
    measured
      .map(({ column, width }) => cell(column).padEnd(width))
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
