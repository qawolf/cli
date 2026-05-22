import {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
} from "~/domains/flows/expand.js";
import { resolveUniqueEnvDir } from "~/domains/flows/ensureDeps.js";
import { buildPatternArgs } from "~/core/patternArgs.js";
import { errorMessage } from "~/core/errors.js";
import { defaultSpawn } from "~/shell/spawn.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { resolvePlaywrightCli } from "~/shell/playwright.js";
import { installBrowsers } from "~/domains/install/browsers.js";

export async function handleInstallBrowsers(
  ctx: CommandContext,
  pattern: string | undefined,
  envDir?: string,
): Promise<CommandResult> {
  const cwd = process.cwd();
  let resolvedDir = envDir;
  if (!resolvedDir) {
    const files = await defaultExpandPatterns(buildPatternArgs(pattern), cwd);
    try {
      resolvedDir = resolveUniqueEnvDir(files) ?? cwd;
    } catch (err: unknown) {
      return { error: errorMessage(err), exitCode: 2 };
    }
  }
  return installBrowsers(ctx, pattern, {
    cwd,
    spawn: defaultSpawn,
    platform: process.platform,
    expandPatterns: defaultExpandPatterns,
    peekFlowMeta: defaultPeekFlowMeta,
    playwrightCliPath: resolvePlaywrightCli(resolvedDir),
  });
}
