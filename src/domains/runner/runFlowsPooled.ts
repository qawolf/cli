import type { Reporter } from "~/shell/reporter/types.js";

import type { FlowCounts } from "./runHelpers.js";
import type { ResolvedFlow } from "./runInternals.js";
import type { FlowRunResult } from "./types.js";

export type DispatchResult = { run: FlowRunResult; durationMs: number };

export type PooledDispatch = (flow: ResolvedFlow) => Promise<DispatchResult>;

/**
 * Concurrent counterpart to {@link runFlows}. Runs up to `workers` flows at
 * once via the injected `dispatch`. Production injects a subprocess-backed
 * dispatch so each flow gets its own process realm — concurrent flows in a
 * single realm would race on the `@qawolf/flows` global runtime (see
 * initFlowRuntime.ts). Tests inject a fake dispatch.
 *
 * Bail semantics: on the first failure with `bail`, no further flows are
 * launched; flows already in flight drain. Unstarted flows count as skipped.
 */
export async function runFlowsPooled(args: {
  flows: readonly ResolvedFlow[];
  workers: number;
  bail: boolean;
  maxAttempts: number;
  reporter: Reporter;
  now: () => number;
  dispatch: PooledDispatch;
}): Promise<{ counts: FlowCounts; durationMs: number }> {
  const { flows, workers, bail, maxAttempts, reporter, now, dispatch } = args;
  const counts: FlowCounts = {
    flowsPassed: 0,
    flowsFailed: 0,
    flowsSkipped: 0,
    testsPassed: 0,
    testsTotal: 0,
  };
  const startTime = now();
  let bailed = false;
  let next = 0;

  async function worker(): Promise<void> {
    while (!bailed) {
      const index = next++;
      if (index >= flows.length) return;
      const flow = flows[index];
      if (!flow) return;

      reporter.onFlowStart?.({ name: flow.name, path: flow.file });
      const { run, durationMs } = await dispatch(flow);

      counts.testsPassed += run.testCounts.passed;
      counts.testsTotal += run.testCounts.total;
      if (run.passed) {
        counts.flowsPassed++;
        reporter.onFlowPass?.({
          name: flow.name,
          path: flow.file,
          tests: run.testCounts,
          durationMs,
          manifest: run.manifest,
        });
      } else {
        counts.flowsFailed++;
        reporter.onFlowFail?.({
          name: flow.name,
          path: flow.file,
          err: run.error ?? new Error("Flow failed"),
          tests: run.testCounts,
          durationMs,
          attempt: run.attempts,
          maxAttempts,
          manifest: run.manifest,
        });
        if (bail) bailed = true;
      }
    }
  }

  const poolSize = Math.min(workers, flows.length);
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  counts.flowsSkipped =
    flows.length - (counts.flowsPassed + counts.flowsFailed);

  return { counts, durationMs: now() - startTime };
}
