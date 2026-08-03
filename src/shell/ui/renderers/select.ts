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

export type SelectFn = (
  message: string,
  options: readonly SelectOption[],
) => Promise<PromptResult<string>>;

export function createSelect({ mode, clack }: SelectDeps): SelectFn {
  return async (message, options) => {
    assertHumanMode(mode, "select");

    const value = await clack.select({ message, options: [...options] });
    if (clack.isCancel(value)) return { ok: false };
    return { ok: true, value };
  };
}
