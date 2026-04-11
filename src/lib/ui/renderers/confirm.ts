import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";
import { assertHumanMode } from "./assertHumanMode.js";
import type { PromptResult } from "./types.js";

type ConfirmDeps = { mode: OutputMode; clack: StyledClack };

export function createConfirm({
  mode,
  clack,
}: ConfirmDeps): (message: string) => Promise<PromptResult<boolean>> {
  return async (message: string): Promise<PromptResult<boolean>> => {
    assertHumanMode(mode, "confirm");
    const value = await clack.confirm({ message });
    if (clack.isCancel(value)) return { ok: false };
    return { ok: true, value };
  };
}
