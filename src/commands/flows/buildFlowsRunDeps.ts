import { makePeekFlowMeta } from "~/domains/flows/expand.js";
import { findFlowStamp as defaultFindFlowStamp } from "~/shell/manifest/lookup.js";
import { installBrowserList } from "~/domains/install/browsers.js";
import { defaultSpawn } from "~/shell/spawn.js";
import { runAndroidFlow as defaultRunAndroidFlow } from "~/domains/runner/runAndroidFlow.js";
import { runWebFlow as defaultRunWebFlow } from "~/domains/runner/runWebFlow.js";
import { makePooledDispatch } from "~/domains/runner/makePooledDispatch.js";
import type { createAndroidDeps } from "~/domains/runner/runAndroidFlowDeps.js";
import type { RunWebFlowDeps } from "~/domains/runner/runWebFlow.js";
import type { FlowRuntimeDeps } from "~/domains/runner/flowRuntimeDeps.js";
import type {
  FlowsRunDeps,
  FlowsRunFlags,
} from "~/domains/runner/runInternals.js";
import type { CommandContext } from "~/shell/commandContext.js";

import { buildRunReporter } from "./buildRunReporter.js";

type BuildFlowsRunDepsArgs = {
  ctx: CommandContext;
  resolvedDir: string;
  android: ReturnType<typeof createAndroidDeps>;
  runWebFlowDeps: RunWebFlowDeps;
  flowRuntimeDeps: FlowRuntimeDeps;
  flags: FlowsRunFlags;
  projectDir: string | undefined;
};

/**
 * Assembles the runner dependency bundle for `flowsRun`. Identical across the
 * local (`flows run`) and hybrid (`--env`) entry points, so both share this
 * single builder. `runWebFlowDeps` is resolved by the caller (it is async and
 * the injection point for tests) and passed in already awaited.
 */
export function buildFlowsRunDeps(args: BuildFlowsRunDepsArgs): FlowsRunDeps {
  const {
    ctx,
    resolvedDir,
    android,
    runWebFlowDeps,
    flowRuntimeDeps,
    flags,
    projectDir,
  } = args;
  return {
    peekFlowMeta: makePeekFlowMeta(ctx.fs),
    installBrowsers: (innerCtx, browsers) =>
      installBrowserList(innerCtx, browsers, {
        spawn: defaultSpawn,
        platform: process.platform,
        browserDeps: flags.browserDeps,
        envDir: resolvedDir,
        checkExists: (path) => ctx.fs.existsSync(path),
      }),
    runWebFlow: defaultRunWebFlow,
    runWebFlowDeps: { ...runWebFlowDeps, flowRuntimeDeps },
    runAndroidFlow: defaultRunAndroidFlow,
    runAndroidFlowDeps: { ...android.deps, flowRuntimeDeps },
    bootAndroid: android.boot,
    shutdownAndroid: android.shutdown,
    createPooledDispatch: makePooledDispatch(resolvedDir),
    findFlowStamp: defaultFindFlowStamp,
    warn: (message) => ctx.ui.warn(message),
    logger: ctx.log("runner"),
    // Route reporter output through ctx.ui so streamed test logs stay inside the run's timeline.
    reporter: buildRunReporter(flags, {
      fs: ctx.fs,
      stdout: { write: (text: string) => ctx.ui.write(text) },
      stderr: { write: (text: string) => ctx.ui.write(text) },
      ...(projectDir !== undefined ? { projectDir } : {}),
    }),
    now: () => Date.now(),
  };
}
