import { formatCIError } from "~/shell/ui/renderers/formatters/ci.js";
import {
  writeJsonLine,
  writeStderrLine,
  writeStderrRaw,
} from "~/shell/ui/renderers/write.js";
import { finalizeResults } from "./progress.js";
import type { RendererSet } from "./types.js";

export function createAgentRenderers(): RendererSet {
  return {
    intro: (title) => writeStderrLine(title),
    note: (message, title) =>
      writeStderrLine(`${title ? `${title}: ` : ""}${message}`),
    outro: (message) => writeStderrLine(message),
    cancel: (message) => writeStderrLine(message),
    step: (message, progress) => {
      writeStderrLine(
        progress
          ? `[${String(progress.current)}/${String(progress.total)}] ${message}`
          : message,
      );
    },
    success: (message) => writeStderrLine(message),
    warn: (message) => writeStderrLine(message),
    info: (message) => writeStderrLine(message),
    error: (title, body) => {
      process.stderr.write(formatCIError(title, body));
    },
    output: (data, humanMessage) => {
      writeJsonLine(data);
      writeStderrLine(humanMessage);
    },
    gap: () => writeStderrLine(""),
    write: (text) => writeStderrRaw(text),
    withProgress: async (steps, done) => {
      const results: unknown[] = [];
      const total = steps.length;
      for (const [i, step] of steps.entries()) {
        const label = (message: string) =>
          `[${String(i + 1)}/${String(total)}] ${message}`;
        writeStderrLine(label(step.message));
        results.push(
          await step.task((message) => writeStderrLine(label(message))),
        );
      }

      const { typed, doneMessage } = finalizeResults(results, done);
      writeStderrLine(doneMessage);
      return typed;
    },
  };
}
