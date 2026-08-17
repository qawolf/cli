import { runnerMessages } from "~/core/messages/index.js";
import { pluralize } from "~/core/pluralize.js";

import { FlowRunError } from "./errors.js";
import type { RunAndroidFlowOptions } from "./runAndroidFlow.js";
import type { RunWebFlowOptions } from "./runWebFlow.js";
import type { FlowsRunDeps, ResolvedFlow } from "./runInternals.js";
import type { FlowRunResult } from "./types.js";

export async function dispatchFlow({
  deps,
  flow,
  webOptions,
  androidOptions,
}: {
  deps: FlowsRunDeps;
  flow: ResolvedFlow;
  webOptions: RunWebFlowOptions;
  androidOptions: RunAndroidFlowOptions;
}): Promise<{ run: FlowRunResult; durationMs: number }> {
  deps.logger?.info(`run: ${flow.name}`);
  deps.reporter.onFlowStart?.({ name: flow.name, path: flow.file });
  const flowStart = deps.now();
  let run: FlowRunResult;
  try {
    const loggerPatch =
      deps.logger !== undefined ? { logger: deps.logger } : {};
    if (flow.kind === "web") {
      run = await deps.runWebFlow({
        deps: { ...deps.runWebFlowDeps, ...loggerPatch },
        options: webOptions,
        flowPath: flow.file,
      });
    } else {
      // flow.kind === "android"
      if (deps.runAndroidFlowDeps === "not-wired") {
        // TODO WIZ-10343
        throw new Error("Android flows are not yet supported in this mode.");
      }
      run = await deps.runAndroidFlow({
        deps: { ...deps.runAndroidFlowDeps, ...loggerPatch },
        options: androidOptions,
        flowPath: flow.file,
      });
    }
  } catch (err) {
    run = {
      passed: false,
      testCounts: { passed: 0, total: 0 },
      attempts: 1,
      error: new FlowRunError(flow.name, 1, err),
    };
  }
  // Stamping is supplementary diagnostics — surface I/O failures via
  // deps.warn, but never let a lookup error erase the pass/fail outcome.
  let stamp;
  try {
    stamp = await deps.findFlowStamp(flow.file);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    deps.warn(runnerMessages.manifestStampReadFailed(flow.file, message));
  }
  if (stamp) run = { ...run, manifest: stamp };
  const durationMs = deps.now() - flowStart;
  const outcome = run.passed ? "pass" : "fail";
  const attempt = pluralize(run.attempts, "attempt");
  deps.logger?.info(`${outcome}: ${flow.name} (${durationMs}ms, ${attempt})`);
  return { run, durationMs };
}
