export type PromptResult<T> = { ok: true; value: T } | { ok: false };

/** A table laid out for a width: its header, and how to draw any one item. */
export type FilterTable<Item> = {
  readonly header: string;
  readonly line: (item: Item) => string;
};

/** What the footer says for a moment after an action. */
export type FilterNotice = {
  readonly tone: "success" | "warning";
  readonly text: string;
};

/** Something Ctrl plus a letter does to the marked items. */
export type FilterAction<Item> = {
  /** The letter pressed with Ctrl: "y" for Ctrl-Y. */
  readonly key: string;
  /** Shown in the footer, e.g. "copy path". */
  readonly label: string;
  /**
   * Gets the marked items in list order, or the highlighted one when none are
   * marked. Resolves with what the footer tells the user.
   */
  readonly run: (items: readonly Item[]) => Promise<FilterNotice>;
};

export type FilterListArgs<Item> = {
  readonly message: string;
  readonly items: readonly Item[];
  /** Text a search matches against. It need not all be on screen. */
  readonly searchText: (item: Item) => readonly (string | undefined)[];
  /** Fixes column widths for the full list while the visible rows change. */
  readonly table: (items: readonly Item[], width: number) => FilterTable<Item>;
  readonly describeCount: (matched: number, total: number) => string;
  readonly actions: readonly FilterAction<Item>[];
  /** One line about the highlighted item, shown under the table. */
  readonly detail: (item: Item) => string;
};

/**
 * A table that narrows as the user types, and whose rows Tab marks. Resolves,
 * when the user presses Enter, with the marked items, or with every item
 * still showing when none are marked.
 */
export type FilterListFn = <Item>(
  args: FilterListArgs<Item>,
) => Promise<PromptResult<readonly Item[]>>;
