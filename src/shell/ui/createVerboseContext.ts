import { createStyledClack, type StyledClack } from "./clack/index.js";
import type { OutputMode } from "./env.js";
import { writeJsonDiagnostic } from "./renderers/write.js";

type VerboseTarget = { write: ((msg: string) => void) | undefined };

/**
 * Builds the clack instance, verboseTarget ref, and verboseWrite callback
 * for the composite root. Extracted here to keep context.ts within the
 * max-lines limit.
 */
export function createVerboseContext(
  outputMode: OutputMode,
  isVerbose: boolean,
): {
  clack: StyledClack;
  verboseTarget: VerboseTarget | undefined;
  verboseWrite:
    | ((level: string, scope: string, msg: string) => void)
    | undefined;
} {
  const clack = createStyledClack();

  const verboseTarget: VerboseTarget | undefined =
    outputMode === "human" && isVerbose ? { write: undefined } : undefined;

  let verboseWrite:
    | ((level: string, scope: string, msg: string) => void)
    | undefined;
  if (isVerbose) {
    if (outputMode === "json") {
      verboseWrite = (level, scope, msg) =>
        writeJsonDiagnostic({ type: "log", level, scope, message: msg });
    } else if (outputMode === "human") {
      verboseWrite = (level, scope, msg) => {
        if (verboseTarget?.write) {
          verboseTarget.write(`[${scope}] ${msg}`);
          return;
        }
        const text = `[${scope}] ${msg}`;
        if (level === "warn") clack.log.warn(text);
        else if (level === "error") clack.log.error(text);
        else clack.log.info(text);
      };
    }
  }

  return { clack, verboseTarget, verboseWrite };
}
