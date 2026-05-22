import { createStyledClack } from "./clack/index.js";
import type { OutputMode } from "./env.js";
import { createConfirm } from "./renderers/confirm.js";
import { createJson } from "./renderers/json.js";
import { pickRenderers } from "./renderers/modes/index.js";
import { createPassword } from "./renderers/password.js";
import type { UI } from "./types.js";

export function createUI(mode: OutputMode): UI {
  const clack = createStyledClack();

  return {
    mode,
    ...pickRenderers(mode, clack),
    confirm: createConfirm({ mode, clack }),
    password: createPassword({ mode, clack }),
    json: createJson(),
  };
}
