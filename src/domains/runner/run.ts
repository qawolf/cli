import { classifyTarget, flowBasename } from "~/core/flowMeta.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import type { RunSummary } from "~/shell/reporter/types.js";
import type { BrowserName } from "~/core/types.js";

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
  files: readonly string[],
  flags: FlowsRunFlags,
  deps: FlowsRunDeps,
): Promise<CommandResult> {
  if (flags.workers > 1) {
    const message = "--workers > 1 is deferred to v0.2; current cap is 1.";
    ctx.ui.error(message);
    return { error: message, exitCode: 2 };
  }

  const flows: ResolvedFlow[] = [];
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const metas = await Promise.all(batch.map((f) => deps.peekFlowMeta(f)));
    for (const [j, meta] of metas.entries()) {
      const file = batch[j]!;
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
      } else {
        const message = unsupportedTargetMessage(meta.target);
        ctx.ui.error(message);
        return { error: message, exitCode: 2 };
      }
    }
  }

  flows.sort((a, b) => a.file.localeCompare(b.file));

  if (flows.length === 0) {
    ctx.ui.info("No flows matched.");
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

  const { webOptions, androidOptions } = buildRunOptions(flags);
  const { counts, durationMs } = await runFlows(
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
    durationMs,
    meta: {
      browsers,
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
