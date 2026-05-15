import { flowBasename, isAndroidTarget, targetToBrowser } from "~/commands/flows/expand.js";
import type { CommandContext, CommandResult } from "~/lib/context.js";
import type { RunSummary } from "~/lib/reporter/types.js";
import type { BrowserName } from "~/types.js";

import { buildRunOptions, runFlows } from "./runHelpers.js";
import {
  type FlowsRunDeps,
  type FlowsRunFlags,
  type ResolvedFlow,
  type WebResolvedFlow,
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
      if (browser) {
        flows.push({
          kind: "web",
          file,
          name: meta.name ?? flowBasename(file),
          browser,
        });
      } else if (isAndroidTarget(meta.target)) {
        flows.push({
          kind: "android",
          file,
          name: meta.name ?? flowBasename(file),
          target: meta.target,
        });
      } else {
        const message = unsupportedTargetMessage(meta.target);
        ctx.ui.error(message);
        return { error: message, exitCode: 2 };
      }
    }
  }

  if (flows.length === 0) {
    ctx.ui.info("No flows matched.");
    return;
  }

  const webFlows = flows.filter((f): f is WebResolvedFlow => f.kind === "web");
  const browsers = [
    ...new Set<BrowserName>(webFlows.map((f) => f.browser)),
  ].sort();
  if (browsers.length > 0) {
    await deps.installBrowsers(ctx, browsers);
  }

  const { webOptions, androidOptions } = buildRunOptions(flags);
  const { counts, startTime } = await runFlows(
    flows,
    flags,
    deps,
    webOptions,
    androidOptions,
  );

  const summary: RunSummary = {
    flowsPassed: counts.flowsPassed,
    flowsFailed: counts.flowsFailed,
    flowsSkipped: counts.flowsSkipped,
    testsPassed: counts.testsPassed,
    testsTotal: counts.testsTotal,
    durationMs: deps.now() - startTime,
    meta: {
      browsers: webFlows.map((f) => f.browser),
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
