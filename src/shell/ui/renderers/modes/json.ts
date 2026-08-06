import {
  writeJsonDiagnostic,
  writeJsonLine,
} from "~/shell/ui/renderers/write.js";
import { finalizeResults } from "./progress.js";
import type { RendererSet } from "./types.js";

export function createJsonRenderers(): RendererSet {
  return {
    intro: (title) => writeJsonDiagnostic({ type: "intro", title }),
    note: (message, title) =>
      writeJsonDiagnostic({ type: "note", title, message }),
    outro: (message) => writeJsonDiagnostic({ type: "outro", message }),
    cancel: (message) => writeJsonDiagnostic({ type: "cancel", message }),
    step: (message, progress) => {
      writeJsonDiagnostic({
        type: "step",
        message,
        step: progress?.current,
        total: progress?.total,
      });
    },
    success: (message) => writeJsonDiagnostic({ type: "success", message }),
    warn: (message) => writeJsonDiagnostic({ type: "warn", message }),
    info: (message) => writeJsonDiagnostic({ type: "info", message }),
    error: (title, body) => writeJsonDiagnostic({ type: "error", title, body }),
    output: (data, _humanMessage) => writeJsonLine(data),
    gap: () => {},
    stream: (data, _line) => writeJsonLine(data),
    write: () => {},
    withProgress: async (steps, done) => {
      const results: unknown[] = [];
      const total = steps.length;
      for (const [i, step] of steps.entries()) {
        writeJsonDiagnostic({
          type: "step",
          message: step.message,
          step: i + 1,
          total,
        });
        // Step events already carry structure; per-file progress updates would
        // only add noise for NDJSON consumers.
        results.push(await step.task(() => {}));
      }

      const { typed, doneMessage } = finalizeResults(results, done);
      writeJsonDiagnostic({ type: "success", message: doneMessage });
      return typed;
    },
  };
}
