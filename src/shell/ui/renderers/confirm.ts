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

    if (opts?.destructive) {
      const key = await clack.selectKey({
        message,
        caseSensitive: false,
        options: [
          { value: "y", label: "Yes" },
          { value: "n", label: "No" },
        ],
      });
      if (clack.isCancel(key)) return { ok: false };
      return { ok: true, value: key === "y" };
    }

    const value = await clack.confirm({ message });
    if (clack.isCancel(value)) return { ok: false };
    return { ok: true, value };
  };
}
