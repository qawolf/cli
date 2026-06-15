import { runnerMessages } from "~/core/messages/index.js";

import type { RunAndroidFlowOptions } from "./runAndroidFlow.js";
import type { RunWebFlowOptions } from "./runWebFlow.js";
import { resolveAvdName } from "./runAndroidFlowUtils.js";

import type {
  AndroidResolvedFlow,
  FlowsRunDeps,
  FlowsRunFlags,
  ResolvedFlow,
} from "./runInternals.js";
import { dispatchFlow } from "./runInternals.js";

export type FlowCounts = {
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
      headed: flags.headed,
      slowMo: 0,
      video: flags.video,
      trace: flags.trace,
      timeout: flags.timeout,
      har: flags.har,
      harContent: flags.harContent,
    },
    androidOptions: {
      retries: flags.retries,
      outputDir: flags.outputDir,
      recordVideo: flags.video !== "off",
    },
  };
}

/**
 * Boots the AVDs needed by the given android flows. Returns an error message
 * to surface (and abort on) when boot fails, or undefined when there is
 * nothing to boot or boot succeeds.
 */
export async function bootAndroidFlows(
  deps: Pick<FlowsRunDeps, "bootAndroid">,
  androidFlows: readonly AndroidResolvedFlow[],
): Promise<string | undefined> {
  if (androidFlows.length === 0 || !deps.bootAndroid) return undefined;
  const avdNames = [
    ...new Set(
      androidFlows.map((f) =>
        resolveAvdName(f.target as Parameters<typeof resolveAvdName>[0]),
      ),
    ),
  ];
  try {
    await deps.bootAndroid(avdNames);
    return undefined;
  } catch (err) {
    return err instanceof Error
      ? err.message
      : runnerMessages.androidBootFailed;
  }
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
        manifest: run.manifest,
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
        manifest: run.manifest,
      });
      if (flags.bail) bailed = true;
    }
  }

  return { counts, durationMs: deps.now() - startTime };
}
