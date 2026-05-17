import { createStyledClack } from "./clack/index.js";
import type { OutputMode } from "./env.js";
import { createCancel } from "./renderers/cancel.js";
import { writeStderrLine, writeStdoutRaw } from "./renderers/write.js";
import { createConfirm } from "./renderers/confirm.js";
import { createError } from "./renderers/error.js";
import { createGap } from "./renderers/gap.js";
import { createInfo } from "./renderers/info.js";
import { createIntro } from "./renderers/intro.js";
import { createJson } from "./renderers/json.js";
import { createNote } from "./renderers/note.js";
import { createOutput } from "./renderers/output.js";
import { createOutro } from "./renderers/outro.js";
import { createPassword } from "./renderers/password.js";
import { createStep } from "./renderers/step.js";
import { createSuccess } from "./renderers/success.js";
import { createWarn } from "./renderers/warn.js";
import { createWithProgress } from "./renderers/withProgress.js";
import type { UI } from "./types.js";

export function createUI(mode: OutputMode): UI {
  const clack = createStyledClack();

  return {
    mode,
    confirm: createConfirm({ mode, clack }),
    gap: createGap({ mode }),
    intro: createIntro({ mode, clack }),
    note: createNote({ mode, clack }),
    outro: createOutro({ mode, clack }),
    password: createPassword({ mode, clack }),
    withProgress: createWithProgress({ mode, clack }),
    step: createStep({ mode, clack }),
    success: createSuccess({ mode, clack }),
    warn: createWarn({ mode, clack }),
    cancel: createCancel({ mode, clack }),
    json: createJson(),
    output: createOutput({ mode, clack }),
    error: createError({ mode, clack }),
    info: createInfo({ mode, clack }),
    write: (text: string) => {
      if (mode === "human") writeStdoutRaw(text);
      else if (mode === "agent") writeStderrLine(text);
    },
  };
}
