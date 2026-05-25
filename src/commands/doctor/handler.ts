import packageJson from "../../../package.json" with { type: "json" };

import { avdNameForTarget } from "~/core/androidTargets.js";
import { batchMap, flowBatchSize } from "~/core/batchMap.js";
import { resolveApiKey } from "~/domains/auth/resolve.js";
import { runChecks } from "~/domains/doctor/checks/index.js";
import { renderResults } from "~/domains/doctor/render.js";
import type { CheckResult } from "~/domains/doctor/types.js";
import { resolveUniqueEnvDir } from "~/domains/flows/ensureDeps.js";
import { expandPatterns, makePeekFlowMeta } from "~/domains/flows/expand.js";
import { resolveAppiumBin } from "~/shell/appium/resolveAppiumBin.js";
import {
  type CommandContext,
  type CommandResult,
} from "~/shell/commandContext.js";
import { resolvePlaywrightCli } from "~/shell/playwright.js";
import { defaultSpawn } from "~/shell/spawn.js";

type HandleDoctorOpts = { readonly all: boolean };

async function collectRequiredAvds(
  files: readonly string[],
  peekFlowMeta: ReturnType<typeof makePeekFlowMeta>,
): Promise<string[]> {
  const seen = new Set<string>();
  for await (const meta of batchMap(files, peekFlowMeta, flowBatchSize)) {
    if (!meta.target) continue;
    const avd = avdNameForTarget(meta.target);
    if (avd) seen.add(avd);
  }
  return [...seen];
}

export async function handleDoctor(
  ctx: CommandContext,
  opts: HandleDoctorOpts,
): Promise<CommandResult> {
  const { fs } = ctx;
  const cwd = process.cwd();
  const flowFiles = await expandPatterns([], cwd, undefined, fs);

  // Playwright lives in the env dir (installed by ensureFlowDeps), not in cwd.
  // Silently fall back to cwd when no env dir is found or flows span multiple packages.
  let envDir: string | undefined;
  try {
    envDir = resolveUniqueEnvDir([...flowFiles], fs);
  } catch {
    // multiple env dirs — fall back to cwd
  }
  let playwrightCliPath: string | undefined;
  try {
    playwrightCliPath = resolvePlaywrightCli(envDir ?? cwd, process.platform);
  } catch {
    playwrightCliPath = undefined;
  }

  const resolved = await resolveApiKey(ctx.configDir, fs);

  const requiredAvds = await collectRequiredAvds(
    flowFiles,
    makePeekFlowMeta(fs),
  );
  const runAndroidChecks = opts.all || requiredAvds.length > 0;

  const cliCheck: CheckResult = {
    name: "qawolf",
    status: "pass",
    version: packageJson.version,
  };

  const results = await runChecks({
    apiKey: resolved?.key,
    fetch: globalThis.fetch,
    spawn: defaultSpawn,
    apiBaseUrl: ctx.apiBaseUrl,
    enginesNode: packageJson.engines.node,
    processVersion: process.version,
    flowFiles,
    readFile: (path) => ctx.fs.readFile(path),
    cwd,
    playwrightCliPath,
    runAndroidChecks,
    androidHome: process.env["ANDROID_HOME"] ?? process.env["ANDROID_SDK_ROOT"],
    checkExists: (path: string) => ctx.fs.existsSync(path),
    envDir,
    resolveAppiumBin,
    requiredAvds,
  });
  const allResults = [cliCheck, ...results];
  renderResults(ctx.ui, allResults);
  const fails = allResults.filter((result) => result.status === "fail");
  if (fails.length > 0) return { error: `${fails.length} check(s) failed` };
}
