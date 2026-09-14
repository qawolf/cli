import type { Readable } from "node:stream";
import { AutocompletePrompt, isCancel } from "@clack/core";

import { createSearchIndex } from "~/core/textSearch.js";
import type { OutputMode } from "~/shell/ui/env.js";

import { openAltScreen } from "./altScreen.js";
import { assertHumanMode } from "./assertHumanMode.js";
import { type TerminalStream, withDebouncedResize } from "./debouncedResize.js";
import { createFrameDrawer } from "./filterView.js";
import type { FilterListArgs, FilterListFn, PromptResult } from "./types.js";

type Deps = {
  mode: OutputMode;
  input?: Readable;
  output?: TerminalStream;
};

const resizeSettleMs = 100;

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
    const output = terminal.output;

    const options = args.items.map((item, index) => ({ value: index, item }));
    const matches = createSearchIndex(options, (option) =>
      args.searchText(option.item),
    );

    const draw = createFrameDrawer(args, output);

    const screen = openAltScreen(output);
    const prompt = new AutocompletePrompt({
      options,
      filter: matches,
      output,
      input: deps.input ?? process.stdin,
      // Paint whole frames after resizes; returning an empty frame prevents
      // clack from diffing against its stale pre-resize screen.
      render() {
        if (!isDone(this.state)) screen.paint(draw(this));
        return "";
      },
    });
    const result = await prompt.prompt().finally(() => {
      screen.close();
      terminal.dispose();
    });

    output.write(`${draw(prompt, isCancel(result) ? "cancel" : "submit")}\n`);

    if (isCancel(result)) return { ok: false };
    return {
      ok: true,
      value: prompt.filteredOptions.map((option) => option.item),
    };
  };
}
