import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";
import { writeJsonDiagnostic, writeStderrLine } from "./write.js";

export interface ProgressStep<T = unknown> {
  message: string;
  task: () => Promise<T>;
}

type InferStepResults<T extends readonly ProgressStep[]> = {
  -readonly [K in keyof T]: T[K] extends ProgressStep<infer R> ? R : never;
} & unknown[];

type WithProgressDone<R extends unknown[] = unknown[]> =
  | string
  | ((results: R) => string);

export type WithProgressFn = <Steps extends readonly ProgressStep[]>(
  steps: [...Steps],
  done: WithProgressDone<InferStepResults<Steps>>,
) => Promise<InferStepResults<Steps>>;

type FinalizeResult<Steps extends readonly ProgressStep[]> = {
  typed: InferStepResults<Steps>;
  doneMessage: string;
};

// TypeScript cannot narrow an accumulated unknown[] to a mapped tuple type,
// so a single assertion is unavoidable here.
function finalizeResults<Steps extends readonly ProgressStep[]>(
  results: unknown[],
  done: WithProgressDone<InferStepResults<Steps>>,
): FinalizeResult<Steps> {
  const typed = results as InferStepResults<Steps>;
  const doneMessage = typeof done === "function" ? done(typed) : done;
  return { typed, doneMessage };
}

type WithProgressDeps = { mode: OutputMode; clack: StyledClack };

export function createWithProgress({
  mode,
  clack,
}: WithProgressDeps): WithProgressFn {
  return async (steps, done) => {
    const results: unknown[] = [];

    switch (mode) {
      case "human": {
        const s = clack.spinner();
        const total = steps.length;

        try {
          for (const [i, step] of steps.entries()) {
            const label = `(${String(i + 1)}/${String(total)}) ${step.message}`;
            if (i === 0) {
              s.start(label);
            } else {
              s.message(label);
            }
            results.push(await step.task());
          }

          const { typed, doneMessage } = finalizeResults(results, done);
          s.stop(doneMessage);
          return typed;
        } catch (err) {
          s.stop();
          throw err;
        }
      }
      case "agent": {
        for (const step of steps) {
          writeStderrLine(step.message);
          results.push(await step.task());
        }

        const { typed, doneMessage } = finalizeResults(results, done);
        writeStderrLine(doneMessage);
        return typed;
      }
      case "json": {
        for (const step of steps) {
          writeJsonDiagnostic({ type: "step", message: step.message });
          results.push(await step.task());
        }

        const { typed, doneMessage } = finalizeResults(results, done);
        writeJsonDiagnostic({ type: "success", message: doneMessage });
        return typed;
      }
    }
  };
}
