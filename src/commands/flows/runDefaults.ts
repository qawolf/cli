import {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
} from "~/commands/flows/expand.js";
import { handleInstallBrowsers as defaultInstallBrowsers } from "~/commands/install/browsers.js";
import type { CommandContext, CommandResult } from "~/lib/context.js";

import { flowsRun } from "./run.js";
import type { FlowsRunFlags } from "./runInternals.js";

export async function handleFlowsRun(
  ctx: CommandContext,
  pattern: string | undefined,
  flags: FlowsRunFlags,
): Promise<CommandResult> {
  return flowsRun(ctx, pattern, flags, {
    cwd: process.cwd(),
    expandPatterns: defaultExpandPatterns,
    peekFlowMeta: defaultPeekFlowMeta,
    installBrowsers: defaultInstallBrowsers,
  });
}
