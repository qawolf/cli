export type ProgressStep<T = unknown> = {
  message: string;
  /**
   * `update` replaces the step's displayed message while the task runs, e.g.
   * with a per-file download counter. Tasks without in-flight progress can
   * ignore it.
   */
  task: (update: (message: string) => void) => Promise<T>;
};

export type InferStepResults<T extends readonly ProgressStep[]> = {
  -readonly [K in keyof T]: T[K] extends ProgressStep<infer R> ? R : never;
} & unknown[];

export type WithProgressDone<R extends unknown[] = unknown[]> =
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
export function finalizeResults<Steps extends readonly ProgressStep[]>(
  results: unknown[],
  done: WithProgressDone<InferStepResults<Steps>>,
): FinalizeResult<Steps> {
  const typed = results as InferStepResults<Steps>;
  const doneMessage = typeof done === "function" ? done(typed) : done;
  return { typed, doneMessage };
}
