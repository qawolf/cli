import path from "node:path";

import { targetToBrowser } from "~/commands/flows/expand.js";
import type { CommandContext, CommandResult } from "~/lib/context.js";

import {
  type FlowsRunDeps,
  type FlowsRunFlags,
  type ResolvedFlow,
  unsupportedTargetMessage,
} from "./runInternals.js";

export type { FlowsRunFlags } from "./runInternals.js";

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
  for (const file of files) {
    const meta = await deps.peekFlowMeta(file);
    if (!meta.target) continue;
    const browser = targetToBrowser(meta.target);
    if (!browser) {
      const message = unsupportedTargetMessage(meta.target);
      ctx.ui.error(message);
      return { error: message, exitCode: 2 };
    }
    flows.push({
      file,
      name: meta.name ?? path.basename(file, ".flow.ts"),
      browser,
    });
  }

  if (flows.length === 0) {
    ctx.ui.info("No flows matched.");
    return;
  }

  const installResult = await deps.installBrowsers(ctx, pattern);
  if (installResult && "error" in installResult) {
    return installResult;
  }

  // Dispatch lands in a follow-up PR. Pre-flight verified targets and
  // installed browsers; report what was prepared.
  ctx.ui.info(`Pre-flight complete: ${flows.length} web flow(s) ready to run.`);
}
