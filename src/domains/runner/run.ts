import { classifyTarget, flowBasename } from "~/core/flowMeta.js";
import { batchMap, flowBatchSize } from "~/core/batchMap.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import type { RunSummary } from "~/shell/reporter/types.js";
import type { BrowserName } from "~/core/types.js";
import { runnerMessages } from "~/core/messages/index.js";
import { pluralize } from "~/core/pluralize.js";

import { buildRunOptions, runFlows } from "./runHelpers.js";
import {
  type AndroidResolvedFlow,
  type FlowsRunDeps,
  type FlowsRunFlags,
  type ResolvedFlow,
  type WebResolvedFlow,
} from "./runInternals.js";
import { resolveAvdName } from "./runAndroidFlowUtils.js";

export async function flowsRun(
  ctx: CommandContext,
  files: readonly string[],
  flags: FlowsRunFlags,
  deps: FlowsRunDeps,
): Promise<CommandResult> {
  if (flags.workers > 1) {
    ctx.ui.error(runnerMessages.workersCapError);
    return { error: runnerMessages.workersCapError, exitCode: 2 };
  }

  const flows: ResolvedFlow[] = [];
  const skippedByType = new Map<string, number>();
  for await (const { file, ...meta } of batchMap(
    files,
    async (file) => ({ file, ...(await deps.peekFlowMeta(file)) }),
    flowBatchSize,
  )) {
    if (!meta.target) continue;
    const classified = classifyTarget(meta.target);
    if (classified?.kind === "web") {
      flows.push({
        kind: "web",
        file,
        name: meta.name ?? flowBasename(file),
        browser: classified.browser,
      });
    } else if (classified?.kind === "android") {
      flows.push({
        kind: "android",
        file,
        name: meta.name ?? flowBasename(file),
        target: meta.target,
      });
    } else if (classified) {
      const typeName = classified.kind === "ios" ? "iOS" : meta.target;
      skippedByType.set(typeName, (skippedByType.get(typeName) ?? 0) + 1);
    } else {
      ctx.ui.error(`Unrecognized flow target: "${meta.target}"`);
      return { error: "unrecognized flow target", exitCode: 2 };
    }
  }

  for (const [type, count] of skippedByType) {
    ctx.ui.warn(`${pluralize(count, `${type} flow`)} skipped`);
  }

  flows.sort((a, b) => a.file.localeCompare(b.file));

  if (flows.length === 0) {
    if (skippedByType.size === 0) {
      ctx.ui.info(runnerMessages.noFlowsMatched);
    }
    return;
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

  const { webOptions, androidOptions } = buildRunOptions(flags);
  let counts: Awaited<ReturnType<typeof runFlows>>["counts"];
  let durationMs: number;
  try {
    if (androidFlows.length > 0 && deps.bootAndroid) {
      const avdNames = [
        ...new Set(
          androidFlows.map((f) =>
            resolveAvdName(f.target as Parameters<typeof resolveAvdName>[0]),
          ),
        ),
      ];
      try {
        await deps.bootAndroid(avdNames);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : runnerMessages.androidBootFailed;
        ctx.ui.error(message);
        return { error: message };
      }
    }
    ({ counts, durationMs } = await runFlows(
      flows,
      flags,
      deps,
      webOptions,
      androidOptions,
    ));
  } finally {
    deps.shutdownAndroid?.();
  }

  const summary: RunSummary = {
    flowsPassed: counts.flowsPassed,
    flowsFailed: counts.flowsFailed,
    flowsSkipped: counts.flowsSkipped,
    testsPassed: counts.testsPassed,
    testsTotal: counts.testsTotal,
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

  if (counts.flowsFailed > 0) {
    return { error: `${counts.flowsFailed} flow(s) failed` };
  }
}
