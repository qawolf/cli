import { readFile } from "node:fs/promises";

import packageJson from "../../package.json" with { type: "json" };

import { expandPatterns } from "~/commands/flows/expand.js";
import { type CommandContext, type CommandResult } from "~/lib/context.js";
import { resolvePlaywrightCli } from "~/lib/playwright.js";

import { defaultSpawn, runChecks } from "./checks/index.js";
import { renderResults } from "./render.js";

export async function handleDoctor(
  ctx: CommandContext,
): Promise<CommandResult> {
  const cwd = process.cwd();
  const flowFiles = await expandPatterns([], cwd);
  let playwrightCliPath: string | undefined;
  try {
    playwrightCliPath = resolvePlaywrightCli();
  } catch {
    playwrightCliPath = undefined;
  }
  const results = await runChecks({
    env: process.env,
    fetch: globalThis.fetch,
    spawn: defaultSpawn,
    apiBaseUrl: ctx.apiBaseUrl,
    enginesNode: packageJson.engines.node,
    processVersion: process.version,
    flowFiles,
    readFile: (path) => readFile(path, "utf-8"),
    cwd,
    execPath: process.execPath,
    playwrightCliPath,
  });
  renderResults(ctx.ui, results);
  const fails = results.filter((result) => result.status === "fail");
  if (fails.length > 0) return { error: `${fails.length} check(s) failed` };
}
