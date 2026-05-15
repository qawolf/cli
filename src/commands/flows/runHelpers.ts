import type { RunAndroidFlowOptions } from "~/lib/runner/runAndroidFlow.js";
import type { RunWebFlowOptions } from "~/lib/runner/runWebFlow.js";

import type {
  FlowsRunDeps,
  FlowsRunFlags,
  ResolvedFlow,
} from "./runInternals.js";
import { dispatchFlow } from "./runInternals.js";

type FlowCounts = {
  flowsPassed: number;
  flowsFailed: number;
  flowsSkipped: number;
  testsPassed: number;
  testsTotal: number;
};

export function buildRunOptions(flags: FlowsRunFlags): {
  webOptions: RunWebFlowOptions;
  androidOptions: RunAndroidFlowOptions;
} {
  return {
    webOptions: {
      retries: flags.retries,
      outputDir: flags.outputDir,
      headed: false,
      slowMo: 0,
      video: flags.video,
      timeout: flags.timeout,
    },
    androidOptions: {
      retries: flags.retries,
      outputDir: flags.outputDir,
      recordVideo: flags.video !== "off",
    },
  };
}

export async function runFlows(
  flows: ResolvedFlow[],
  flags: FlowsRunFlags,
  deps: FlowsRunDeps,
  webOptions: RunWebFlowOptions,
  androidOptions: RunAndroidFlowOptions,
): Promise<{
  counts: FlowCounts;
  durationMs: number;
}> {
  const counts: FlowCounts = {
    flowsPassed: 0,
    flowsFailed: 0,
    flowsSkipped: 0,
    testsPassed: 0,
    testsTotal: 0,
  };
  const startTime = deps.now();
  let bailed = false;

  for (const flow of flows) {
    if (bailed) {
      counts.flowsSkipped++;
      continue;
    }
    const { run, durationMs } = await dispatchFlow({
      deps,
      flow,
      reporter: deps.reporter,
      webOptions,
      androidOptions,
    });
    counts.testsPassed += run.testCounts.passed;
    counts.testsTotal += run.testCounts.total;
    if (run.passed) {
      counts.flowsPassed++;
      deps.reporter.onFlowPass?.({
        name: flow.name,
        path: flow.file,
        tests: run.testCounts,
        durationMs,
      });
    } else {
      counts.flowsFailed++;
      deps.reporter.onFlowFail?.({
        name: flow.name,
        path: flow.file,
        err: run.error ?? new Error("Flow failed"),
        tests: run.testCounts,
        durationMs,
        attempt: run.attempts,
        maxAttempts: flags.retries + 1,
      });
      if (flags.bail) bailed = true;
    }
  }

  return { counts, durationMs: deps.now() - startTime };
}
