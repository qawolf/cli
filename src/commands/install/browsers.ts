import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
  targetToBrowser,
} from "~/commands/flows/expand.js";
import { defaultSpawn } from "~/doctor/checks/index.js";
import type { SpawnFn, SpawnResult } from "~/doctor/types.js";
import type { CommandContext, CommandResult } from "~/lib/context.js";
import type { BrowserName } from "~/types.js";

export type InstallBrowsersDeps = {
  readonly cwd: string;
  readonly spawn: SpawnFn;
  readonly platform: NodeJS.Platform;
  readonly expandPatterns: typeof defaultExpandPatterns;
  readonly peekFlowMeta: typeof defaultPeekFlowMeta;
  readonly execPath: string;
  readonly playwrightCliPath: string;
};

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

  for (const browser of browsers) {
    ctx.ui.info(`Installing ${browser}...`);
    const args = buildArgs(deps.playwrightCliPath, browser, deps.platform);
    const result = await deps.spawn(deps.execPath, args);
    if (result.exitCode !== 0) {
      return { error: formatError(browser, result) };
    }
  }

  ctx.ui.success(`Installed ${browsers.length} browser(s).`);
}

async function collectBrowsers(
  files: readonly string[],
  peekFlowMeta: typeof defaultPeekFlowMeta,
): Promise<BrowserName[]> {
  const seen = new Set<BrowserName>();
  for (const file of files) {
    const meta = await peekFlowMeta(file);
    if (!meta.target) continue;
    const browser = targetToBrowser(meta.target);
    if (browser) seen.add(browser);
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

function resolvePlaywrightCli(): string {
  const require_ = createRequire(import.meta.url);
  const pkgPath = require_.resolve("playwright/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
    bin?: string | Record<string, string>;
  };
  const binEntry =
    typeof pkg.bin === "string"
      ? pkg.bin
      : (pkg.bin?.["playwright"] ?? "cli.js");
  return join(dirname(pkgPath), binEntry);
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
