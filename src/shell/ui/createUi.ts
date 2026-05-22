import { createStyledClack } from "./clack/index.js";
import type { StyledClack } from "./clack/index.js";
import type { OutputMode } from "./env.js";
import { createConfirm } from "./renderers/confirm.js";
import { createJson } from "./renderers/json.js";
import { pickRenderers } from "./renderers/modes/index.js";
import { createPassword } from "./renderers/password.js";
import type { UI } from "./types.js";

export function createUI(
  mode: OutputMode,
  opts: {
    clack?: StyledClack;
    verboseTarget?: { write: ((msg: string) => void) | undefined };
  } = {},
): UI {
  const clack = opts.clack ?? createStyledClack();

  return {
    mode,
    ...pickRenderers(mode, clack, opts.verboseTarget),
    confirm: createConfirm({ mode, clack }),
    password: createPassword({ mode, clack }),
    json: createJson(),
  };
}
