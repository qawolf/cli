import {
  expandPatterns as defaultExpandPatterns,
  makePeekFlowMeta,
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
  const { fs } = ctx;
  let resolvedDir = envDir;
  if (!resolvedDir) {
    const files = await defaultExpandPatterns(
      buildPatternArgs(pattern),
      cwd,
      undefined,
      fs,
    );
    try {
      resolvedDir = resolveUniqueEnvDir(files, fs) ?? cwd;
    } catch (err: unknown) {
      return { error: errorMessage(err), exitCode: 2 };
    }
  }
  return installBrowsers(ctx, pattern, {
    cwd,
    spawn: defaultSpawn,
    platform: process.platform,
    expandPatterns: (patterns, dir) =>
      defaultExpandPatterns(patterns, dir ?? cwd, undefined, fs),
    peekFlowMeta: makePeekFlowMeta(fs),
    playwrightCliPath: resolvePlaywrightCli(resolvedDir, process.platform),
  });
}
