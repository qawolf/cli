import type { StyledClack } from "~/shell/ui/clack/index.js";
import { writeStdoutRaw } from "~/shell/ui/renderers/write.js";
import { finalizeResults } from "./progress.js";
import type { RendererSet } from "./types.js";

export function createHumanRenderers(clack: StyledClack): RendererSet {
  return {
    intro: (title) => clack.intro(title),
    note: (message, title) => clack.note(message, title),
    outro: (message) => clack.outro(message),
    cancel: (message) => clack.cancel(message),
    step: (message, progress) => {
      clack.log.step(
        progress
          ? `[${String(progress.current)}/${String(progress.total)}] ${message}`
          : message,
      );
    },
    success: (message) => clack.log.success(message),
    warn: (message) => clack.log.warn(message),
    info: (message) => clack.log.info(message),
    error: (title, body) => {
      clack.log.error(title + (body ? `\n${body}` : ""));
    },
    output: (_data, humanMessage) => clack.log.info(humanMessage),
    gap: () => process.stderr.write("\n"),
    write: (text) => writeStdoutRaw(text),
    withProgress: async (steps, done) => {
      const results: unknown[] = [];
      const s = clack.spinner();
      const total = steps.length;
      let currentLabel = "";

      try {
        for (const [i, step] of steps.entries()) {
          currentLabel = `[${String(i + 1)}/${String(total)}] ${step.message}`;
          if (i === 0) {
            s.start(currentLabel);
          } else {
            s.message(currentLabel);
          }
          results.push(await step.task());
        }

        const { typed, doneMessage } = finalizeResults(results, done);
        s.stop(doneMessage);
        return typed;
      } catch (err) {
        s.error(currentLabel);
        throw err;
      }
    },
  };
}
