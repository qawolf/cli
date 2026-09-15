import type { FilterAction, FilterNotice } from "./types.js";

type Key = {
  readonly name?: string | undefined;
  readonly ctrl?: boolean | undefined;
};

/** "^Y copy path · ^O copy id": the footer's reminder of what the keys do. */
export function actionHints<Item>(
  actions: readonly FilterAction<Item>[],
): string {
  return actions
    .map((action) => `^${action.key.toUpperCase()} ${action.label}`)
    .join(" · ");
}

export function createActionRunner<Item>(args: {
  readonly actions: readonly FilterAction<Item>[];
  readonly holdMs: number;
  readonly changed: () => void;
}): {
  onKey: (key: Key, targets: readonly Item[]) => void;
  notice: () => FilterNotice | undefined;
  dispose: () => void;
} {
  let notice: FilterNotice | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const show = (next: FilterNotice): void => {
    if (disposed) return;
    notice = next;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      notice = undefined;
      timer = undefined;
      args.changed();
    }, args.holdMs);
    args.changed();
  };

  return {
    onKey(key, targets) {
      if (key.ctrl !== true || targets.length === 0) return;
      const action = args.actions.find(
        (candidate) => candidate.key === key.name,
      );
      if (action === undefined) return;
      void action
        .run(targets)
        .then(show, () =>
          show({ tone: "warning", text: `Could not ${action.label}.` }),
        );
    },
    notice: () => notice,
    dispose() {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
    },
  };
}
