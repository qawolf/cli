import {
  expandPatterns as defaultExpandPatterns,
  makePeekFlowMeta,
} from "~/domains/flows/expand.js";
import { resolveUniqueEnvDir } from "~/domains/flows/ensureDeps.js";
import { ensureRuntimeEnv } from "~/domains/runtimeEnv/index.js";
import { buildPatternArgs } from "~/core/patternArgs.js";
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

  let depsRoot: string;
  if (envDir !== undefined) {
    depsRoot = envDir;
  } else {
    const files = await defaultExpandPatterns(
      buildPatternArgs(pattern),
      cwd,
      undefined,
      fs,
    );
    let projectDir: string | undefined;
    try {
      projectDir = resolveUniqueEnvDir(files, fs);
    } catch {
      projectDir = undefined;
    }
    ({ depsRoot } = await ensureRuntimeEnv(
      projectDir !== undefined ? { projectDir } : {},
      { fs },
    ));
  }

  return installBrowsers(ctx, pattern, {
    cwd,
    spawn: defaultSpawn,
    platform: process.platform,
    expandPatterns: (patterns, dir) =>
      defaultExpandPatterns(patterns, dir ?? cwd, undefined, fs),
    peekFlowMeta: makePeekFlowMeta(fs),
    playwrightCliPath: resolvePlaywrightCli(depsRoot, process.platform),
  });
}
