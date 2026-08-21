import { classifyTarget, flowBasename } from "~/core/flowMeta.js";
import { batchMap, flowBatchSize } from "~/core/batchMap.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import type { RunSummary } from "~/shell/reporter/types.js";
import type { BrowserName } from "~/core/types.js";
import { runnerMessages } from "~/core/messages/index.js";

import { collectJsonFailureDetails } from "./jsonFailureDetails.js";
import { buildRunOptions } from "./runHelpers.js";
import { executeFlows } from "./dispatchFlows.js";
import { noMatchResult } from "./noMatch.js";
import {
  type AndroidResolvedFlow,
  type FlowsRunDeps,
  type FlowsRunFlags,
  type ResolvedFlow,
  type WebResolvedFlow,
} from "./runInternals.js";

export async function flowsRun(
  ctx: CommandContext,
  files: readonly string[],
  flags: FlowsRunFlags,
  deps: FlowsRunDeps,
): Promise<CommandResult> {
  const flows: ResolvedFlow[] = [];
  const skippedByType = new Map<string, number>();
  for await (const { file, ...meta } of batchMap(
    files,
    async (file) => ({ file, ...(await deps.peekFlowMeta(file)) }),
    flowBatchSize,
  )) {
    if (!meta.target) continue;
    const classified = classifyTarget(meta.target);
    if (classified.kind === "web") {
      flows.push({
        kind: "web",
        file,
        name: meta.name ?? flowBasename(file),
        browser: classified.browser,
      });
    } else if (classified.kind === "android") {
      flows.push({
        kind: "android",
        file,
        name: meta.name ?? flowBasename(file),
        target: meta.target,
      });
    } else if (classified.kind === "unrecognized") {
      ctx.ui.error(runnerMessages.unrecognizedTarget(meta.target));
      return { error: "unrecognized flow target", exitCode: 2 };
    } else {
      const typeName = classified.kind === "ios" ? "iOS" : meta.target;
      skippedByType.set(typeName, (skippedByType.get(typeName) ?? 0) + 1);
    }
  }

  for (const [type, count] of skippedByType) {
    ctx.ui.warn(runnerMessages.flowsSkipped(type, count));
  }

  flows.sort((a, b) => a.file.localeCompare(b.file));

  if (flows.length === 0) {
    const skipped = skippedByType.size > 0;
    return noMatchResult(ctx, {
      allowNoMatch: flags.allowNoMatch,
      error: skipped
        ? runnerMessages.noRunnableFlows
        : runnerMessages.noTargetedFlows,
      // The per-type skip warnings above already explain an empty selection.
      notice: skipped ? undefined : runnerMessages.noFlowsMatched,
    });
  }

  const webFlows = flows.filter((f): f is WebResolvedFlow => f.kind === "web");
  // TODO WIZ-10505: browser here comes from the flow's `target` field (static
  // metadata), but the browser actually launched at runtime is chosen by
  // deps.launch() inside the flow body. If they disagree, Playwright fails
  // with an opaque "browser not installed" error. Detect and report the mismatch.
  const browsers = [
    ...new Set<BrowserName>(webFlows.map((f) => f.browser)),
  ].sort();
  if (browsers.length > 0) {
    await deps.installBrowsers(ctx, browsers);
  }

  const androidFlows = flows.filter(
    (f): f is AndroidResolvedFlow => f.kind === "android",
  );

  // Worker subprocesses are web-only for now; android parallelism needs
  // per-worker emulator orchestration (tracked separately).
  if (flags.workers > 1 && androidFlows.length > 0) {
    ctx.ui.error(runnerMessages.androidWorkersUnsupported);
    return { error: runnerMessages.androidWorkersUnsupported, exitCode: 2 };
  }

  const { webOptions, androidOptions } = buildRunOptions(flags);

  const collected =
    ctx.outputMode === "json"
      ? collectJsonFailureDetails(deps.reporter, deps.projectDir)
      : undefined;
  const failureDetails = collected?.details ?? [];
  const reporter = collected?.reporter ?? deps.reporter;

  const result = await executeFlows({
    ctx,
    deps: { ...deps, reporter },
    flags,
    flows,
    webFlows,
    androidFlows,
    webOptions,
    androidOptions,
  });
  if ("error" in result) {
    ctx.ui.error(result.error);
    return { error: result.error };
  }
  const { counts, durationMs } = result;

  const summary: RunSummary = {
    ...counts,
    durationMs,
    meta: {
      browsers,
      workers: flags.workers,
      headed: flags.headed,
      video: flags.video,
      trace: flags.trace,
      har: flags.har,
    },
  };
  deps.reporter.onRunComplete?.({ summary });
  ctx.ui.gap();

  if (counts.flowsFailed > 0) {
    const error = runnerMessages.flowsFailed(counts.flowsFailed);
    // Human and agent modes already streamed the detail via the reporter;
    // attaching it here too would print every failure twice.
    if (ctx.outputMode === "json" && failureDetails.length > 0) {
      return { error, errorBody: failureDetails.join("\n\n") };
    }
    return { error };
  }
}
