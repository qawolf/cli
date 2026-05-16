import { readFile } from "node:fs/promises";

import packageJson from "../../package.json" with { type: "json" };

import { expandPatterns } from "~/commands/flows/expand.js";
import { resolveUniqueEnvDir } from "~/commands/flows/ensureDeps.js";
import { type CommandContext, type CommandResult } from "~/lib/context.js";
import { resolveApiKey } from "~/lib/auth/resolve.js";
import { resolvePlaywrightCli } from "~/lib/playwright.js";

import { defaultSpawn } from "~/lib/spawn.js";

import { runChecks } from "./checks/index.js";
import { renderResults } from "./render.js";

export async function handleDoctor(
  ctx: CommandContext,
): Promise<CommandResult> {
  const cwd = process.cwd();
  const flowFiles = await expandPatterns([], cwd);

  // Playwright lives in the env dir (installed by ensureFlowDeps), not in cwd.
  // Silently fall back to cwd when no env dir is found or flows span multiple packages.
  let envDir: string | undefined;
  try {
    envDir = resolveUniqueEnvDir([...flowFiles]);
  } catch {
    // multiple env dirs — fall back to cwd
  }
  let playwrightCliPath: string | undefined;
  try {
    playwrightCliPath = resolvePlaywrightCli(envDir ?? cwd);
  } catch {
    playwrightCliPath = undefined;
  }

  const resolved = await resolveApiKey(ctx.configDir);

  const results = await runChecks({
    apiKey: resolved?.key,
    fetch: globalThis.fetch,
    spawn: defaultSpawn,
    apiBaseUrl: ctx.apiBaseUrl,
    enginesNode: packageJson.engines.node,
    processVersion: process.version,
    flowFiles,
    readFile: (path) => readFile(path, "utf-8"),
    cwd,
    playwrightCliPath,
  });
  renderResults(ctx.ui, results);
  const fails = results.filter((result) => result.status === "fail");
  if (fails.length > 0) return { error: `${fails.length} check(s) failed` };
}
