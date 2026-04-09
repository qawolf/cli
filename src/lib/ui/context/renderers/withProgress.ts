import type { StyledClack } from "../../clack/index.js";
import type { OutputMode } from "../../env.js";
import { assertHumanMode } from "../assertHumanMode.js";
import type { ProgressStep, WithProgressDone } from "../types.js";

type WithProgressDeps = { mode: OutputMode; clack: StyledClack };

export function createWithProgress({
  mode,
  clack,
}: WithProgressDeps): (
  steps: ProgressStep[],
  done: WithProgressDone,
) => Promise<unknown[]> {
  return async (
    steps: ProgressStep[],
    done: WithProgressDone,
  ): Promise<unknown[]> => {
    assertHumanMode(mode, "withProgress");
    const s = clack.spinner();
    const total = steps.length;
    const results: unknown[] = [];

    for (const [i, step] of steps.entries()) {
      const label = `(${String(i + 1)}/${String(total)}) ${step.message}`;
      if (i === 0) {
        s.start(label);
      } else {
        s.message(label);
      }
      results.push(await step.task());
    }

    const doneMessage = typeof done === "function" ? done(results) : done;
    s.stop(doneMessage);
    return results;
  };
}
