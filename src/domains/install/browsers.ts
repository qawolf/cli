import { targetToBrowser, type PeekFlowMetaFn } from "~/core/flowMeta.js";
import { installMessages } from "~/core/messages/index.js";
import { buildPatternArgs } from "~/core/patternArgs.js";
import {
  playwrightCliInvocation,
  playwrightCliJsPath,
} from "~/core/playwrightCli.js";
import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import type { BrowserName } from "~/core/types.js";
import { batchMap, flowBatchSize } from "~/core/batchMap.js";

export type InstallBrowsersDeps = {
  readonly cwd: string;
  readonly spawn: SpawnFn;
  readonly execPath: string;
  readonly platform: NodeJS.Platform;
  /** When false, skip Playwright's OS-level dependency install (Linux `--with-deps`). */
  readonly browserDeps: boolean;
  readonly expandPatterns: (
    patterns: string[],
    cwd?: string,
  ) => Promise<string[]>;
  readonly peekFlowMeta: PeekFlowMetaFn;
  readonly checkExists: (path: string) => boolean;
  /** Resolves the dependency root (override / project / managed) from expanded flow files. */
  readonly resolveDepsRoot: (files: string[]) => Promise<string>;
};

export type InstallBrowserListDeps = {
  readonly spawn: SpawnFn;
  readonly execPath: string;
  readonly platform: NodeJS.Platform;
  /** When false, skip Playwright's OS-level dependency install (Linux `--with-deps`). */
  readonly browserDeps: boolean;
  readonly envDir: string;
  readonly checkExists: (path: string) => boolean;
};

export async function installBrowserList(
  ctx: CommandContext,
  browsers: BrowserName[],
  deps: InstallBrowserListDeps,
): Promise<void> {
  const cliJsPath = playwrightCliJsPath(deps.envDir);
  if (!deps.checkExists(cliJsPath)) {
    throw new Error(installMessages.playwrightNotFound(cliJsPath));
  }

  await ctx.ui.withProgress(
    browsers.map((browser) => ({
      message: installMessages.installingBrowser(browser),
      task: async () => {
        const invocation = playwrightCliInvocation({
          envDir: deps.envDir,
          execPath: deps.execPath,
          cliArgs: buildArgs(browser, deps.platform, deps.browserDeps),
        });
        const result = await deps.spawn(invocation.cmd, invocation.args, {
          platform: deps.platform,
          env: invocation.env,
        });
        if (result.exitCode !== 0) {
          throw new Error(formatError(browser, result));
        }
      },
    })),
    installMessages.browsersInstalled(browsers.length),
  );
}

export async function installBrowsers(
  ctx: CommandContext,
  pattern: string | undefined,
  deps: InstallBrowsersDeps,
): Promise<CommandResult> {
  const patterns = buildPatternArgs(pattern);
  const files = await deps.expandPatterns(patterns, deps.cwd);

  const browsers = await collectBrowsers(files, deps.peekFlowMeta);
  if (browsers.length === 0) {
    ctx.ui.info(installMessages.noBrowserFlows);
    return;
  }

  await installBrowserList(ctx, browsers, {
    spawn: deps.spawn,
    execPath: deps.execPath,
    platform: deps.platform,
    browserDeps: deps.browserDeps,
    envDir: await deps.resolveDepsRoot(files),
    checkExists: deps.checkExists,
  });
}

async function collectBrowsers(
  files: readonly string[],
  peekFlowMeta: PeekFlowMetaFn,
): Promise<BrowserName[]> {
  const seen = new Set<BrowserName>();
  for await (const meta of batchMap(files, peekFlowMeta, flowBatchSize)) {
    if (!meta.target) continue;
    const browser = targetToBrowser(meta.target);
    if (browser) seen.add(browser);
  }
  return [...seen].sort();
}

function buildArgs(
  browser: BrowserName,
  platform: NodeJS.Platform,
  browserDeps: boolean,
): string[] {
  // --with-deps runs apt-get, which needs root even when every package is
  // already present; --no-browser-deps lets non-root Linux runners with
  // preinstalled system libraries skip it.
  return platform === "linux" && browserDeps
    ? ["install", "--with-deps", browser]
    : ["install", browser];
}

function formatError(browser: BrowserName, result: SpawnResult): string {
  if (result.exitCode < 0) {
    return installMessages.playwrightInstallLaunchFailed(browser);
  }
  const detail =
    (result.stderr || result.stdout).split("\n")[0]?.trim() ||
    `exit code ${result.exitCode}`;
  return installMessages.playwrightInstallFailed(browser, detail);
}
