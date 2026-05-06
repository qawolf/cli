import packageJson from "../../package.json" with { type: "json" };

import { type CommandContext, type CommandResult } from "~/lib/context.js";

import { defaultSpawn, runChecks } from "./checks/index.js";
import { renderResults } from "./render.js";

export async function handleDoctor(
  ctx: CommandContext,
): Promise<CommandResult> {
  const results = await runChecks({
    env: process.env,
    fetch: globalThis.fetch,
    spawn: defaultSpawn,
    apiBaseUrl: ctx.apiBaseUrl,
    enginesNode: packageJson.engines.node,
    processVersion: process.version,
  });
  renderResults(ctx.ui, results);
  const fails = results.filter((result) => result.status === "fail");
  if (fails.length > 0) return { error: `${fails.length} check(s) failed` };
}
