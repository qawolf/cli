import path from "node:path";

import { targetToBrowser } from "~/commands/flows/expand.js";
import type { CommandContext, CommandResult } from "~/lib/context.js";
import type { BrowserName } from "~/types.js";

import {
  type FlowsRunDeps,
  type FlowsRunFlags,
  type ResolvedFlow,
  unsupportedTargetMessage,
} from "./runInternals.js";

const BATCH_SIZE = 32;

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
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
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
        name: meta.name ?? path.basename(file, ".flow.ts"),
        browser,
      });
    }
  }

  if (flows.length === 0) {
    ctx.ui.info("No flows matched.");
    return;
  }

  const browsers = [
    ...new Set<BrowserName>(flows.map((f) => f.browser)),
  ].sort();
  await deps.installBrowsers(ctx, browsers);

  // Dispatch is implemented in a follow-up PR. This PR ships only the
  // pre-flight (validation + install). Report what was prepared so the user
  // sees a complete (if partial) action.
  ctx.ui.info(
    `Pre-flight complete: ${flows.length} web flow(s) detected. (Dispatch lands in a follow-up PR.)`,
  );
}
