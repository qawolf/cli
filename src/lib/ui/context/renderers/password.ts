import type { StyledClack } from "../../clack/index.js";
import type { OutputMode } from "../../env.js";
import { assertHumanMode } from "../assertHumanMode.js";
import type { PromptResult } from "../types.js";

type PasswordDeps = { mode: OutputMode; clack: StyledClack };

export function createPassword({
  mode,
  clack,
}: PasswordDeps): (message: string) => Promise<PromptResult<string>> {
  return async (message: string): Promise<PromptResult<string>> => {
    assertHumanMode(mode, "password");
    const value = await clack.password({ message });
    if (clack.isCancel(value)) return { ok: false };
    return { ok: true, value };
  };
}
