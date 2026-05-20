import { readFile } from "node:fs/promises";

import packageJson from "../../../package.json" with { type: "json" };

import { avdNameForTarget } from "~/core/androidTargets.js";
import { resolveApiKey } from "~/domains/auth/resolve.js";
import { runChecks } from "~/domains/doctor/checks/index.js";
import { renderResults } from "~/domains/doctor/render.js";
import { resolveUniqueEnvDir } from "~/domains/flows/ensureDeps.js";
import { expandPatterns, peekFlowMeta } from "~/domains/flows/expand.js";
import { resolveAppiumBin } from "~/shell/appium/resolveAppiumBin.js";
import {
  type CommandContext,
  type CommandResult,
} from "~/shell/commandContext.js";
import { existsSync } from "~/shell/fs.js";
import { resolvePlaywrightCli } from "~/shell/playwright.js";
import { defaultSpawn } from "~/shell/spawn.js";

type HandleDoctorOpts = { readonly all: boolean };

const peekBatchSize = 32;

async function collectRequiredAvds(
  files: readonly string[],
): Promise<string[]> {
  const seen = new Set<string>();
  for (let i = 0; i < files.length; i += peekBatchSize) {
    const batch = files.slice(i, i + peekBatchSize);
    const metas = await Promise.all(batch.map(peekFlowMeta));
    for (const meta of metas) {
      if (!meta.target) continue;
      const avd = avdNameForTarget(meta.target);
      if (avd) seen.add(avd);
    }
  }
  return [...seen];
}

export async function handleDoctor(
  ctx: CommandContext,
  opts: HandleDoctorOpts,
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

  const requiredAvds = await collectRequiredAvds(flowFiles);
  const runAndroidChecks = opts.all || requiredAvds.length > 0;

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
    runAndroidChecks,
    androidHome: process.env["ANDROID_HOME"] ?? process.env["ANDROID_SDK_ROOT"],
    checkExists: existsSync,
    envDir,
    resolveAppiumBin,
    requiredAvds,
  });
  renderResults(ctx.ui, results);
  const fails = results.filter((result) => result.status === "fail");
  if (fails.length > 0) return { error: `${fails.length} check(s) failed` };
}
