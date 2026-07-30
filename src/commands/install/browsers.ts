import {
  expandPatterns as defaultExpandPatterns,
  makePeekFlowMeta,
} from "~/domains/flows/expand.js";
import { resolveDepsRoot } from "~/commands/resolveDepsRoot.js";
import { defaultSpawn } from "~/shell/spawn.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import { installBrowsers } from "~/domains/install/browsers.js";

export async function handleInstallBrowsers(
  ctx: CommandContext,
  pattern: string | undefined,
  options: { envDir: string | undefined; browserDeps: boolean },
): Promise<CommandResult> {
  const cwd = process.cwd();
  const { fs } = ctx;
  const { envDir, browserDeps } = options;

  return installBrowsers(ctx, pattern, {
    cwd,
    spawn: defaultSpawn,
    platform: process.platform,
    browserDeps,
    expandPatterns: (patterns, dir) =>
      defaultExpandPatterns(patterns, dir ?? cwd, undefined, fs),
    peekFlowMeta: makePeekFlowMeta(fs),
    checkExists: (path) => fs.existsSync(path),
    resolveDepsRoot: async (files) =>
      envDir ?? (await resolveDepsRoot({ files, fs })).depsRoot,
  });
}
