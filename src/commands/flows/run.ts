import { flowBasename, targetToBrowser } from "~/commands/flows/expand.js";
import type { CommandContext, CommandResult } from "~/lib/context.js";
import type { RunSummary } from "~/lib/reporter/types.js";
import type { RunWebFlowOptions } from "~/lib/runner/runWebFlow.js";
import type { BrowserName } from "~/types.js";

import {
  type FlowsRunDeps,
  type FlowsRunFlags,
  type ResolvedFlow,
  dispatchFlow,
  unsupportedTargetMessage,
} from "./runInternals.js";

const batchSize = 32;

export async function flowsRun(
  ctx: CommandContext,
  pattern: string | undefined,
  flags: FlowsRunFlags,
  deps: FlowsRunDeps,
): Promise<CommandResult> {
  if (flags.workers > 1) {
    const message = "--workers > 1 is deferred to v0.2; current cap is 1.";
    ctx.ui.error(message);
    return { error: message, exitCode: 2 };
  }

  const patterns = pattern ? [pattern] : [];
  const files = await deps.expandPatterns(patterns, deps.cwd);

  const flows: ResolvedFlow[] = [];
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const metas = await Promise.all(batch.map((f) => deps.peekFlowMeta(f)));
    for (const [j, meta] of metas.entries()) {
      const file = batch[j]!;
      if (!meta.target) continue;
      const browser = targetToBrowser(meta.target);
      if (!browser) {
        const message = unsupportedTargetMessage(meta.target);
        ctx.ui.error(message);
        return { error: message, exitCode: 2 };
      }
      flows.push({
        file,
        name: meta.name ?? flowBasename(file),
        browser,
      });
    }
  }

  if (flows.length === 0) {
    ctx.ui.info("No flows matched.");
    return;
  }

  // TODO WIZ-10505: browser here comes from the flow's `target` field (static
  // metadata), but the browser actually launched at runtime is chosen by
  // deps.launch() inside the flow body. If they disagree, Playwright fails
  // with an opaque "browser not installed" error. Detect and report the mismatch.
  const browsers = [
    ...new Set<BrowserName>(flows.map((f) => f.browser)),
  ].sort();
  await deps.installBrowsers(ctx, browsers);

  const counts = {
    flowsPassed: 0,
    flowsFailed: 0,
    flowsSkipped: 0,
    testsPassed: 0,
    testsTotal: 0,
  };
  const startTime = deps.now();
  // RunWebFlowOptions omits `browser` — the flow's launch() callback picks it.
  const options: RunWebFlowOptions = {
    retries: flags.retries,
    outputDir: flags.outputDir,
    headed: false,
    slowMo: 0,
    video: flags.video,
    timeout: flags.timeout,
  };
  let bailed = false;

  for (const flow of flows) {
    if (bailed) {
      counts.flowsSkipped++;
      continue;
    }
    const { run, durationMs } = await dispatchFlow(flow, options, deps);
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

  const summary: RunSummary = {
    ...counts,
    durationMs: deps.now() - startTime,
    meta: {
      browsers: [...new Set(flows.map((f) => f.browser))],
      workers: flags.workers,
      headed: false,
      video: flags.video,
      trace: flags.trace,
      har: "off",
    },
  };
  deps.reporter.onRunComplete?.({ summary });

  if (counts.flowsFailed > 0) {
    return { error: `${counts.flowsFailed} flow(s) failed` };
  }
}
