import type { StyledClack } from "../clack/index.js";
import type { OutputMode } from "../env.js";

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

        for (const [i, step] of steps.entries()) {
          const label = `(${String(i + 1)}/${String(total)}) ${step.message}`;
          if (i === 0) {
            s.start(label);
          } else {
            s.message(label);
          }
          results.push(await step.task());
        }

        const typed = results as InferStepResults<typeof steps>;
        const doneMessage = typeof done === "function" ? done(typed) : done;
        s.stop(doneMessage);
        return typed;
      }
      case "agent":
      case "json": {
        for (const step of steps) {
          process.stderr.write(`  ${step.message}\n`);
          results.push(await step.task());
        }

        const typed = results as InferStepResults<typeof steps>;
        const doneMessage = typeof done === "function" ? done(typed) : done;
        process.stderr.write(`  ${doneMessage}\n`);
        return typed;
      }
    }
  };
}
