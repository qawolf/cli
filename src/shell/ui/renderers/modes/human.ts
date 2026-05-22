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
    write: (text) => writeStdoutRaw(text),
    withProgress: async (steps, done) => {
      const results: unknown[] = [];
      const total = steps.length;

      if (verboseTarget) {
        // limit: 20 — cap the scrollback window to 20 lines to avoid flooding the terminal
        const tl = clack.taskLog({
          title: steps[0]?.message ?? "Running",
          limit: 20,
        });
        // NOTE: assumes sequential withProgress calls — concurrent calls would overwrite this ref
        verboseTarget.write = (msg) => tl.message(msg);
        let currentLabel = steps[0]?.message ?? "Running";
        try {
          for (const step of steps) {
            currentLabel = step.message; // set before await so error path names the failing step
            tl.message(step.message);
            results.push(await step.task());
          }
          verboseTarget.write = undefined;
          const { typed, doneMessage } = finalizeResults(results, done);
          tl.success(doneMessage);
          return typed;
        } catch (err) {
          verboseTarget.write = undefined;
          tl.error(currentLabel);
          throw err;
        }
      }

      // existing spinner path — unchanged
      const s = clack.spinner();
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
