import { join, resolve } from "node:path";

import { glob as globFn } from "tinyglobby";
import { validateEnvId } from "~/domains/flows/pull/pull.js";
import { handleFlowsPull } from "~/domains/flows/pull/handler.js";
import type {
  AuthCommandContext,
  CommandResult,
} from "~/shell/commandContext.js";
import { peekFlowMeta as defaultPeekFlowMeta } from "~/domains/flows/expand.js";
import { findFlowStamp as defaultFindFlowStamp } from "~/shell/manifest/lookup.js";
import { installBrowserList } from "~/domains/install/browsers.js";
import { defaultSpawn } from "~/shell/spawn.js";
import { resolvePlaywrightCli } from "~/shell/playwright.js";
import { createConsoleReporter } from "~/shell/reporter/createConsoleReporter.js";
import { runAndroidFlow as defaultRunAndroidFlow } from "~/domains/runner/runAndroidFlow.js";
import { runWebFlow as defaultRunWebFlow } from "~/domains/runner/runWebFlow.js";
import { configureTestkit as defaultConfigureTestkit } from "~/shell/testkit.js";
import { ensureFlowDeps as defaultEnsureFlowDeps } from "~/domains/flows/ensureDeps.js";
import { defaultRunWebFlowDeps } from "~/domains/runner/runWebFlowDeps.js";
import { flowsRun as defaultFlowsRun } from "~/domains/runner/run.js";
import { createAndroidDeps } from "~/domains/runner/runAndroidFlowDeps.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import { _buildPatternArgs, _loadEnvFile } from "./runDefaults.js";

export type HandleHybridFlowsRunDeps = {
  glob: (
    patterns: string[],
    opts: { cwd: string; absolute: boolean },
  ) => Promise<string[]>;
  pullEnv: (ctx: AuthCommandContext, envId: string) => Promise<CommandResult>;
  ensureFlowDeps: (envDir: string) => Promise<void>;
  configureTestkit: (dir: string) => Promise<void>;
  flowsRun: typeof defaultFlowsRun;
  runWebFlowDeps: typeof defaultRunWebFlowDeps;
};

function makeDefaultHybridDeps(): HandleHybridFlowsRunDeps {
  return {
    glob: (patterns, opts) => globFn(patterns, opts),
    pullEnv: (ctx, envId) => handleFlowsPull(ctx, { env: envId, yes: true }),
    ensureFlowDeps: defaultEnsureFlowDeps,
    configureTestkit: defaultConfigureTestkit,
    flowsRun: defaultFlowsRun,
    runWebFlowDeps: defaultRunWebFlowDeps,
  };
}

export async function handleHybridFlowsRun(
  ctx: AuthCommandContext,
  pattern: string | undefined,
  flags: FlowsRunFlags & { env: string },
  deps: HandleHybridFlowsRunDeps = makeDefaultHybridDeps(),
): Promise<CommandResult> {
  const validation = validateEnvId(flags.env);
  if (validation !== "ok") {
    return { error: validation.error, exitCode: 2 };
  }

  const envDir = resolve(join(".qawolf", flags.env));
  const patterns = _buildPatternArgs(pattern);
  const effectivePatterns =
    patterns.length > 0 ? patterns : ["**/*.flow.{ts,js}"];

  let files = await deps.glob(effectivePatterns, {
    cwd: envDir,
    absolute: true,
  });

  if (files.length === 0) {
    const pullResult = await deps.pullEnv(ctx, flags.env);
    if (pullResult !== undefined) return pullResult;

    files = await deps.glob(effectivePatterns, {
      cwd: envDir,
      absolute: true,
    });
    if (files.length === 0) {
      return {
        error:
          pattern !== undefined
            ? `No flows matched '${pattern}' in env '${flags.env}'`
            : `No flows found in env '${flags.env}'`,
        exitCode: 2,
      };
    }
  }

  await ctx.ui.withProgress(
    [
      {
        message: "Preparing environment",
        task: () => deps.ensureFlowDeps(envDir),
      },
    ],
    () => "Environment ready",
  );
  await _loadEnvFile(envDir);
  await deps.configureTestkit(envDir);
  const android = createAndroidDeps(envDir);

  return deps.flowsRun(ctx, files, flags, {
    peekFlowMeta: defaultPeekFlowMeta,
    installBrowsers: (innerCtx, browsers) =>
      installBrowserList(innerCtx, browsers, {
        spawn: defaultSpawn,
        platform: process.platform,
        playwrightCliPath: resolvePlaywrightCli(envDir),
      }),
    runWebFlow: defaultRunWebFlow,
    runWebFlowDeps: await deps.runWebFlowDeps(envDir),
    runAndroidFlow: defaultRunAndroidFlow,
    runAndroidFlowDeps: android.deps,
    bootAndroid: android.boot,
    shutdownAndroid: android.shutdown,
    findFlowStamp: defaultFindFlowStamp,
    warn: (message) => ctx.ui.warn(message),
    reporter: createConsoleReporter({
      stdout: process.stdout,
      stderr: process.stderr,
    }),
    now: () => Date.now(),
  });
}
