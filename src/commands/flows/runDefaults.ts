import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
} from "~/commands/flows/expand.js";
import { installBrowserList } from "~/commands/install/browsers.js";
import { defaultSpawn } from "~/lib/spawn.js";
import type { CommandContext, CommandResult } from "~/lib/context.js";
import { isNoEntError } from "~/lib/errors.js";
import { resolvePlaywrightCli } from "~/lib/playwright.js";
import { createConsoleReporter } from "~/lib/reporter/createConsoleReporter.js";
import { runAndroidFlow as defaultRunAndroidFlow } from "~/lib/runner/runAndroidFlow.js";
import { runWebFlow as defaultRunWebFlow } from "~/lib/runner/runWebFlow.js";
import { configureEmails } from "~/emails/configureEmails.js";
import { configureTestkit } from "~/testkit/stubs.js";

import { parseDotenv } from "./dotenv.js";
import { ensureFlowDeps, resolveUniqueEnvDir } from "./ensureDeps.js";
import { defaultRunWebFlowDeps } from "./runWebFlowDeps.js";
import { flowsRun } from "./run.js";
import type { FlowsRunFlags } from "./runInternals.js";

export async function _loadEnvFile(envDir: string): Promise<void> {
  let content: string;
  try {
    content = await readFile(join(envDir, ".env"), "utf8");
  } catch (err) {
    if (isNoEntError(err)) return;
    throw err;
  }
  const vars = parseDotenv(content);
  for (const [key, value] of Object.entries(vars)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export async function handleFlowsRun(
  ctx: CommandContext,
  pattern: string | undefined,
  flags: FlowsRunFlags,
): Promise<CommandResult> {
  const cwd = process.cwd();

  const expandedFiles = await defaultExpandPatterns(
    pattern ? [pattern] : [],
    cwd,
  );

  let envDir: string | undefined;
  try {
    envDir = resolveUniqueEnvDir(expandedFiles);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { error, exitCode: 2 };
  }

  if (envDir) {
    await ctx.ui.withProgress(
      [
        {
          message: "Preparing environment",
          task: () => ensureFlowDeps(envDir),
        },
      ],
      () => "Environment ready",
    );
    await _loadEnvFile(envDir);
  }

  // Resolve playwright from the env dir; falls back to CWD for local flows.
  const resolvedDir = envDir ?? cwd;

  await Promise.all([
    configureEmails(ctx.apiBaseUrl, resolvedDir),
    configureTestkit(resolvedDir),
  ]);
  return flowsRun(ctx, pattern, flags, {
    cwd,
    expandPatterns: defaultExpandPatterns,
    peekFlowMeta: defaultPeekFlowMeta,
    installBrowsers: (innerCtx, browsers) =>
      installBrowserList(innerCtx, browsers, {
        spawn: defaultSpawn,
        platform: process.platform,
        playwrightCliPath: resolvePlaywrightCli(resolvedDir),
      }),
    runWebFlow: defaultRunWebFlow,
    runWebFlowDeps: defaultRunWebFlowDeps(resolvedDir),
    runAndroidFlow: defaultRunAndroidFlow,
    runAndroidFlowDeps: "not-wired", // TODO WIZ-10343: wire production Android deps
    reporter: createConsoleReporter({
      stdout: process.stdout,
      stderr: process.stderr,
    }),
    now: () => Date.now(),
  });
}
