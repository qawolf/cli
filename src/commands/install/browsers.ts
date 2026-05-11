import {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
  targetToBrowser,
} from "~/commands/flows/expand.js";
import type { SpawnFn, SpawnResult } from "~/doctor/types.js";
import { defaultSpawn } from "~/lib/spawn.js";
import type { CommandContext, CommandResult } from "~/lib/context.js";
import { resolvePlaywrightCli } from "~/lib/playwright.js";
import type { BrowserName } from "~/types.js";

export type InstallBrowserListDeps = {
  readonly spawn: SpawnFn;
  readonly platform: NodeJS.Platform;
  readonly execPath: string;
  readonly playwrightCliPath: string;
};

export type InstallBrowsersDeps = InstallBrowserListDeps & {
  readonly cwd: string;
  readonly expandPatterns: typeof defaultExpandPatterns;
  readonly peekFlowMeta: typeof defaultPeekFlowMeta;
};

export async function installBrowserList(
  ctx: CommandContext,
  browsers: BrowserName[],
  deps: InstallBrowserListDeps,
): Promise<void> {
  const done =
    browsers.length === 1
      ? "Installed 1 browser."
      : `Installed ${browsers.length} browsers.`;

  await ctx.ui.withProgress(
    browsers.map((browser) => ({
      message: `Install ${browser}`,
      task: async () => {
        const args = buildArgs(deps.playwrightCliPath, browser, deps.platform);
        const result = await deps.spawn(deps.execPath, args);
        if (result.exitCode !== 0) {
          throw new Error(formatError(browser, result));
        }
      },
    })),
    done,
  );
}

export async function installBrowsers(
  ctx: CommandContext,
  pattern: string | undefined,
  deps: InstallBrowsersDeps,
): Promise<CommandResult> {
  const patterns = pattern ? [pattern] : [];
  const files = await deps.expandPatterns(patterns, deps.cwd);

  const browsers = await collectBrowsers(files, deps.peekFlowMeta);
  if (browsers.length === 0) {
    ctx.ui.info("No web flows requiring browser installation were found.");
    return;
  }

  await installBrowserList(ctx, browsers, deps);
}

const BATCH_SIZE = 32;

async function collectBrowsers(
  files: readonly string[],
  peekFlowMeta: typeof defaultPeekFlowMeta,
): Promise<BrowserName[]> {
  const seen = new Set<BrowserName>();
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const metas = await Promise.all(batch.map(peekFlowMeta));
    for (const meta of metas) {
      if (!meta.target) continue;
      const browser = targetToBrowser(meta.target);
      if (browser) seen.add(browser);
    }
  }
  return [...seen].sort();
}

function buildArgs(
  cliPath: string,
  browser: BrowserName,
  platform: NodeJS.Platform,
): string[] {
  return platform === "linux"
    ? [cliPath, "install", "--with-deps", browser]
    : [cliPath, "install", browser];
}

function formatError(browser: BrowserName, result: SpawnResult): string {
  if (result.exitCode < 0) {
    return `playwright install ${browser} failed: process failed to launch`;
  }
  const detail =
    (result.stderr || result.stdout).split("\n")[0]?.trim() ||
    `exit code ${result.exitCode}`;
  return `playwright install ${browser} failed: ${detail}`;
}

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
    execPath: process.execPath,
    playwrightCliPath: resolvePlaywrightCli(),
  });
}
