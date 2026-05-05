import { FailWithoutRetryError, FlowRunError } from "./errors.js";
import type {
  FlowDefinition,
  FlowDeps,
  FlowRunResult,
  Runner,
  RunnerDeps,
  RunnerOptions,
} from "./types.js";

export function createRunner({
  deps,
  options,
}: {
  deps: RunnerDeps;
  options: RunnerOptions;
}): Runner {
  const storage = deps.createStorage<FlowDeps>();
  const workflowInputs = options.workflowInputs ?? {};

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
            const flowDeps: FlowDeps = {
              inputs: workflowInputs,
              workflowInputs,
              // TODO WIZ-10421: wire setOutput when output collection lands
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
