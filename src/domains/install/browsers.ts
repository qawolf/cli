import { targetToBrowser, type PeekFlowMetaFn } from "~/core/flowMeta.js";
import { buildPatternArgs } from "~/core/patternArgs.js";
import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";
import type { CommandContext, CommandResult } from "~/shell/commandContext.js";
import type { BrowserName } from "~/core/types.js";

export type InstallBrowsersDeps = {
  readonly cwd: string;
  readonly spawn: SpawnFn;
  readonly platform: NodeJS.Platform;
  readonly expandPatterns: (
    patterns: string[],
    cwd?: string,
  ) => Promise<string[]>;
  readonly peekFlowMeta: PeekFlowMetaFn;
  readonly playwrightCliPath: string;
};

export async function installBrowserList(
  ctx: CommandContext,
  browsers: BrowserName[],
  deps: Pick<InstallBrowsersDeps, "spawn" | "platform" | "playwrightCliPath">,
): Promise<void> {
  const done =
    browsers.length === 1
      ? "Installed 1 browser."
      : `Installed ${browsers.length} browsers.`;

  await ctx.ui.withProgress(
    browsers.map((browser) => ({
      message: `Install ${browser}`,
      task: async () => {
        const args = buildArgs(browser, deps.platform);
        const result = await deps.spawn(deps.playwrightCliPath, args);
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
  const patterns = buildPatternArgs(pattern);
  const files = await deps.expandPatterns(patterns, deps.cwd);

  const browsers = await collectBrowsers(files, deps.peekFlowMeta);
  if (browsers.length === 0) {
    ctx.ui.info("No web flows requiring browser installation were found.");
    return;
  }

  await installBrowserList(ctx, browsers, deps);
}

const batchSize = 32;

async function collectBrowsers(
  files: readonly string[],
  peekFlowMeta: PeekFlowMetaFn,
): Promise<BrowserName[]> {
  const seen = new Set<BrowserName>();
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const metas = await Promise.all(batch.map(peekFlowMeta));
    for (const meta of metas) {
      if (!meta.target) continue;
      const browser = targetToBrowser(meta.target);
      if (browser) seen.add(browser);
    }
  }
  return [...seen].sort();
}

function buildArgs(browser: BrowserName, platform: NodeJS.Platform): string[] {
  return platform === "linux"
    ? ["install", "--with-deps", browser]
    : ["install", browser];
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
