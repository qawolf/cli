export type PromptResult<T> = { ok: true; value: T } | { ok: false };

/** A table laid out for a width: its header, and how to draw any one item. */
export type FilterTable<Item> = {
  readonly header: string;
  readonly line: (item: Item) => string;
};

export type FilterListArgs<Item> = {
  readonly message: string;
  readonly items: readonly Item[];
  /** Text a search matches against. It need not all be on screen. */
  readonly searchText: (item: Item) => readonly (string | undefined)[];
  /** Fixes column widths for the full list while the visible rows change. */
  readonly table: (items: readonly Item[], width: number) => FilterTable<Item>;
  readonly describeCount: (matched: number, total: number) => string;
  /** One line about the highlighted item, shown under the table. */
  readonly detail: (item: Item) => string;
};

/** A searchable table that returns every match when Enter is pressed. */
export type FilterListFn = <Item>(
  args: FilterListArgs<Item>,
) => Promise<PromptResult<readonly Item[]>>;
