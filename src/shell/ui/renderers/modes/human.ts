import type { StyledClack } from "~/shell/ui/clack/index.js";
import { writeStdoutRaw } from "~/shell/ui/renderers/write.js";
import { finalizeResults } from "./progress.js";
import type { RendererSet } from "./types.js";

export function createHumanRenderers(
  clack: StyledClack,
  verboseTarget?: { write: ((msg: string) => void) | undefined },
): RendererSet {
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
    stream: (line) => writeStdoutRaw(`${line}\n`),
    write: (text) => writeStdoutRaw(text),
    withProgress: async (steps, done) => {
      const results: unknown[] = [];
      const total = steps.length;

      if (verboseTarget) {
        // In verbose mode skip the spinner — use clack.log.step per step so output
        // persists after completion. taskLog collapses on tl.success(), which hides
        // the verbose logs the user asked to see.
        let currentLabel = "";
        try {
          for (const [i, step] of steps.entries()) {
            const label = (message: string) =>
              `[${String(i + 1)}/${String(total)}] ${message}`;
            currentLabel = label(step.message);
            clack.log.step(currentLabel);
            results.push(
              await step.task((message) => {
                currentLabel = label(message);
                clack.log.step(currentLabel);
              }),
            );
          }
          const { typed, doneMessage } = finalizeResults(results, done);
          clack.log.success(doneMessage);
          return typed;
        } catch (err) {
          clack.log.error(currentLabel);
          throw err;
        }
      }

      const s = clack.spinner();
      let currentLabel = "";
      try {
        for (const [i, step] of steps.entries()) {
          const label = (message: string) =>
            `[${String(i + 1)}/${String(total)}] ${message}`;
          currentLabel = label(step.message);
          if (i === 0) {
            s.start(currentLabel);
          } else {
            s.message(currentLabel);
          }
          // Track the latest progress label so a mid-task failure reports
          // where the work stopped, not just which step it was in.
          results.push(
            await step.task((message) => {
              currentLabel = label(message);
              s.message(currentLabel);
            }),
          );
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
