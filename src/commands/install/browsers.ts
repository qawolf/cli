import {
  expandPatterns as defaultExpandPatterns,
  makePeekFlowMeta,
} from "~/domains/flows/expand.js";
import { resolveDepsRoot } from "~/commands/resolveDepsRoot.js";
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

  return installBrowsers(ctx, pattern, {
    cwd,
    spawn: defaultSpawn,
    platform: process.platform,
    expandPatterns: (patterns, dir) =>
      defaultExpandPatterns(patterns, dir ?? cwd, undefined, fs),
    peekFlowMeta: makePeekFlowMeta(fs),
    resolvePlaywrightCliPath: async (files) => {
      const depsRoot =
        envDir ?? (await resolveDepsRoot({ files, fs })).depsRoot;
      return resolvePlaywrightCli(depsRoot, process.platform);
    },
  });
}
