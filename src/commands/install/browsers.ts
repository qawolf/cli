import {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
} from "~/domains/flows/expand.js";
import { defaultSpawn } from "~/shell/spawn.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { resolvePlaywrightCli } from "~/shell/playwright.js";
import { installBrowsers } from "~/domains/install/browsers.js";

export async function handleInstallBrowsers(
  ctx: CommandContext,
  pattern: string | undefined,
): Promise<CommandResult> {
  return installBrowsers(ctx, pattern, {
    cwd: process.cwd(),
    spawn: defaultSpawn,
    platform: process.platform,
    expandPatterns: defaultExpandPatterns,
    peekFlowMeta: defaultPeekFlowMeta,
    playwrightCliPath: resolvePlaywrightCli(process.cwd()),
  });
}
