import type { StyledClack } from "~/shell/ui/clack/index.js";
import type { OutputMode } from "~/shell/ui/env.js";
import { assertHumanMode } from "./assertHumanMode.js";
import type { PromptResult } from "./types.js";

type ConfirmDeps = { mode: OutputMode; clack: StyledClack };

type ConfirmOpts = {
  yes?: boolean;
  destructive?: boolean;
};

type ConfirmFn = (
  message: string,
  opts?: ConfirmOpts,
) => Promise<PromptResult<boolean>>;

export function createConfirm({ mode, clack }: ConfirmDeps): ConfirmFn {
  return async (message, opts) => {
    if (opts?.yes) return { ok: true, value: true };
    assertHumanMode(mode, "confirm");

    // Destructive prompts start the cursor on No so a stray Enter is safe.
    const value = await clack.confirm(
      opts?.destructive ? { message, initialValue: false } : { message },
    );
    if (clack.isCancel(value)) return { ok: false };
    return { ok: true, value };
  };
}
