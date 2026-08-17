import { flowFailureHint } from "~/core/flowFailureHint.js";
import { createCompositeReporter } from "~/shell/reporter/createCompositeReporter.js";
import { formatErrorWithCause } from "~/shell/reporter/formatErrorWithCause.js";
import type { Reporter } from "~/shell/reporter/types.js";

export type JsonFailureDetails = {
  // Wraps the caller's reporter; pass this one to the run.
  reporter: Reporter;
  // Populated as flows fail; read it after the run completes.
  details: string[];
};

/**
 * Collects the detail of every failed flow alongside the caller's reporter. In
 * json mode the reporter's streamed output is discarded (`ui.write` is a
 * no-op), so the final error carries these details instead.
 */
export function collectJsonFailureDetails(
  reporter: Reporter,
  projectDir: string | undefined,
): JsonFailureDetails {
  const details: string[] = [];
  return {
    reporter: createCompositeReporter([
      reporter,
      {
        onFlowFail: ({ err }) => {
          const detail = formatErrorWithCause(err);
          const hint = flowFailureHint(detail, projectDir);
          details.push(hint === undefined ? detail : `${detail}\n\n${hint}`);
        },
      },
    ]),
    details,
  };
}
