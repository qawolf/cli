import { matchesSearchTerm } from "~/core/textSearch.js";
import type { StyledClack } from "~/shell/ui/clack/index.js";
import type { OutputMode } from "~/shell/ui/env.js";
import { assertHumanMode } from "./assertHumanMode.js";
import type { PromptResult } from "./types.js";

type SelectDeps = { mode: OutputMode; clack: StyledClack };

// Values are plain strings: clack's Option<Value> is a conditional type
// that only resolves for concrete Value, so a generic passthrough cannot
// typecheck. hint omits `| undefined` because exactOptionalPropertyTypes
// makes clack reject an explicitly-undefined hint; omit the key instead.
type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

/**
 * Above this many options an arrow-key list stops being usable: a QA Wolf
 * employee account reaches every client organization, which is hundreds of
 * entries to scroll past. Below it, a plain list is quicker to answer than a
 * search box is to start typing into.
 */
const searchThreshold = 8;

const searchPlaceholder = "Type to filter";

/**
 * Name, slug, or id — the same three that `QAWOLF_ORGANIZATION` and
 * `QAWOLF_WORKSPACE` accept, so what a person can type at the prompt and what
 * they can put in a script are the same set. Slugs and ids arrive as the
 * option's hint and value.
 */
function matchesSearch(
  search: string,
  option: { value: string; label?: string; hint?: string },
): boolean {
  return matchesSearchTerm(search, [option.label, option.hint, option.value]);
}

export type SelectFn = (
  message: string,
  options: readonly SelectOption[],
) => Promise<PromptResult<string>>;

export function createSelect({ mode, clack }: SelectDeps): SelectFn {
  return async (message, options) => {
    assertHumanMode(mode, "select");

    // Which prompt to use is a question about the list, not about the caller,
    // so it is settled here. A command that offers two choices and one that
    // offers three hundred both ask for a selection.
    const value =
      options.length > searchThreshold
        ? await clack.autocomplete({
            message,
            options: [...options],
            // No `maxItems`: clack then fills the terminal, which is what the
            // plain list has always done. Capping it shrank a long list to a
            // tenth of the rows it used to show, so filtering arrived at the
            // cost of seeing far less at once.
            placeholder: searchPlaceholder,
            filter: matchesSearch,
          })
        : await clack.select({ message, options: [...options] });

    if (clack.isCancel(value)) return { ok: false };
    return { ok: true, value };
  };
}
