import { FailWithoutRetryError, FlowRunError } from "./errors.js";
import type {
  FlowDefinition,
  FlowDeps,
  FlowRunResult,
  RunnerDeps,
  RunnerOptions,
} from "./types.js";

export function createRunner({
  deps,
  options,
}: {
  deps: RunnerDeps;
  options: RunnerOptions;
}) {
  const storage = deps.createStorage<FlowDeps>();

  return {
    run: async (flowDef: FlowDefinition): Promise<FlowRunResult> => {
      const maxAttempts = options.retries + 1;
      const stepCounts = { passed: 0, total: 0 };
      let lastError: FlowRunError | undefined;
      let attempt = 0;
      let aborted = false;

      const deregister = deps.signals.on("SIGTERM", () => {
        aborted = true;
      });

      try {
        while (attempt < maxAttempts && !aborted) {
          attempt++;
          stepCounts.passed = 0;
          stepCounts.total = 0;

          try {
            const workflowInputs = options.workflowInputs ?? {};

            const flowDeps: FlowDeps = {
              inputs: workflowInputs,
              workflowInputs,
              setOutput: () => {},
              test: async (_name, fn) => {
                stepCounts.total++;
                await fn();
                stepCounts.passed++;
              },
            };

            await storage.run(flowDeps, () => flowDef.callback(flowDeps));
            return { passed: true, stepCounts, attempts: attempt };
          } catch (err) {
            lastError = new FlowRunError(flowDef.name, attempt, err);
            if (err instanceof FailWithoutRetryError) break;
          }
        }

        return {
          passed: false,
          stepCounts,
          attempts: attempt,
          ...(lastError !== undefined && { error: lastError }),
        };
      } finally {
        deregister();
      }
    },
  };
}
