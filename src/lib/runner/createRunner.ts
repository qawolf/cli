import { FlowRunError } from "./errors.js";
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
  if (!Number.isInteger(options.retries) || options.retries < 0) {
    throw new Error(
      `retries must be a non-negative integer, got ${options.retries}`,
    );
  }

  const storage = deps.createStorage<FlowDeps>();

  return {
    run: async (flowDef: FlowDefinition): Promise<FlowRunResult> => {
      const maxAttempts = options.retries + 1;
      const testCounts = { passed: 0, total: 0 };
      let lastError: FlowRunError | undefined;
      let attempt = 0;
      let aborted = false;

      const deregister = deps.signals.on("SIGTERM", () => {
        aborted = true;
      });

      try {
        while (attempt < maxAttempts && !aborted) {
          attempt++;
          testCounts.passed = 0;
          testCounts.total = 0;

          try {
            const flowInputs = structuredClone(options.flowInputs ?? {});
            const flowDeps: FlowDeps = {
              flowInputs,
              // TODO WIZ-10421: wire setOutput when output collection lands
              setOutput: () => {},
              test: async (_name, fn) => {
                testCounts.total++;
                await fn();
                testCounts.passed++;
              },
            };

            await storage.run(flowDeps, () => flowDef.callback(flowDeps));
            if (aborted) break;
            return { passed: true, testCounts, attempts: attempt };
          } catch (err) {
            lastError = new FlowRunError(flowDef.name, attempt, err);
            if (
              err instanceof Error &&
              (err.name === "FailWithoutRetryError" ||
                err.constructor.name === "FailWithoutRetryError")
            )
              break;
          }
        }

        return {
          passed: false,
          testCounts,
          attempts: attempt,
          ...(lastError !== undefined && { error: lastError }),
        };
      } finally {
        deregister();
      }
    },
  };
}
