import type { Readable } from "node:stream";
import { AutocompletePrompt, isCancel } from "@clack/core";

import { createSearchIndex } from "~/core/textSearch.js";
import type { OutputMode } from "~/shell/ui/env.js";

import { openAltScreen } from "./altScreen.js";
import { assertHumanMode } from "./assertHumanMode.js";
import { type TerminalStream, withDebouncedResize } from "./debouncedResize.js";
import { actionHints, createActionRunner } from "./filterActions.js";
import { createFrameDrawer } from "./filterView.js";
import { filterInput } from "./filterInput.js";
import type { FilterListArgs, FilterListFn, PromptResult } from "./types.js";

type Deps = {
  mode: OutputMode;
  input?: Readable;
  output?: TerminalStream;
};

const resizeSettleMs = 100;
const noticeHoldMs = 2500;

const isDone = (state: string): boolean =>
  state === "submit" || state === "cancel";

export function createFilterList(deps: Deps): FilterListFn {
  return async function filterList<Item>(
    args: FilterListArgs<Item>,
  ): Promise<PromptResult<readonly Item[]>> {
    assertHumanMode(deps.mode, "filterList");
    const terminal = withDebouncedResize(
      deps.output ?? process.stdout,
      resizeSettleMs,
    );
    try {
      const output = terminal.output;

      const options = args.items.map((item, index) => ({ value: index, item }));
      const matches = createSearchIndex(options, (option) =>
        args.searchText(option.item),
      );

      // Marked items, by their place in the full list rather than in the
      // matches, so a mark outlives the search that found it.
      const marked = new Set<number>();
      const markedItems = (): Item[] =>
        options
          .filter((option) => marked.has(option.value))
          .map((option) => option.item);

      let repaint = (): void => {};
      const actions = createActionRunner<Item>({
        actions: args.actions,
        holdMs: noticeHoldMs,
        changed: () => repaint(),
      });
      const draw = createFrameDrawer(args, output, {
        hints: actionHints(args.actions),
        notice: actions.notice,
        marked,
      });

      const screen = openAltScreen(output);
      let keyboard: ReturnType<typeof filterInput> | undefined;
      try {
        keyboard = filterInput(deps.input ?? process.stdin, (key) => {
          if (
            !key.ctrl ||
            !args.actions.some((action) => action.key === key.name)
          )
            return false;
          const focused = prompt.filteredOptions[prompt.cursor];
          const targets =
            marked.size > 0
              ? markedItems()
              : focused === undefined
                ? []
                : [focused.item];
          actions.onKey(key, targets);
          return true;
        });
        const prompt = new AutocompletePrompt({
          options,
          filter: matches,
          output,
          input: keyboard.input,
          // Paint whole frames after resizes; returning an empty frame prevents
          // clack from diffing against its stale pre-resize screen.
          render() {
            if (!isDone(this.state)) screen.paint(draw(this));
            return "";
          },
        });
        repaint = () => {
          if (!isDone(prompt.state)) screen.paint(draw(prompt));
        };
        // By now clack has handled the key; it draws once this returns.
        prompt.on("key", (_char, key) => {
          const focused = prompt.filteredOptions[prompt.cursor];
          if (key.name !== "tab") return;
          // clack takes Tab back out of the search, so it is free to mark with.
          if (focused === undefined) return;
          if (!marked.delete(focused.value)) marked.add(focused.value);
          // Avoid clack wrapping from the last row back to the first.
          if (prompt.cursor < prompt.filteredOptions.length - 1) {
            // clack keeps its cursor private, so the move is a synthetic ↓ key.
            prompt.emit("key", undefined, { name: "down" });
          }
        });

        const result = await prompt.prompt().finally(() => {
          actions.dispose();
          keyboard?.dispose();
          screen.close();
        });

        output.write(
          `${draw(prompt, isCancel(result) ? "cancel" : "submit")}\n`,
        );

        if (isCancel(result)) return { ok: false };
        return {
          ok: true,
          value:
            marked.size > 0
              ? markedItems()
              : prompt.filteredOptions.map((option) => option.item),
        };
      } finally {
        actions.dispose();
        keyboard?.dispose();
        screen.close();
      }
    } finally {
      terminal.dispose();
    }
  };
}
