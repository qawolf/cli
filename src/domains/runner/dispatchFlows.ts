import { pluralize } from "~/core/pluralize.js";
import type { CommandContext } from "~/shell/commandContext.js";

import type { RunAndroidFlowOptions } from "./runAndroidFlow.js";
import type { RunWebFlowOptions } from "./runWebFlow.js";
import { runFlowsPooled } from "./runFlowsPooled.js";
import { type FlowCounts, bootAndroidFlows, runFlows } from "./runHelpers.js";
import type {
  AndroidResolvedFlow,
  FlowsRunDeps,
  FlowsRunFlags,
  ResolvedFlow,
  WebResolvedFlow,
} from "./runInternals.js";

export type ShouldUseSubprocessPoolArgs = {
  workers: number;
  compiled: boolean;
  webFlowCount: number;
  androidFlowCount: number;
};

/**
 * Whether web flows run in a Bun-runtime subprocess pool rather than in-process.
 * Required for the compiled binary even at single-worker concurrency: it cannot
 * resolve a flow's external node_modules (native modules like sharp) in its own
 * process, but a subprocess worker running as a normal Bun runtime can. Android
 * flows keep the in-process path (their parallelism needs per-worker emulator
 * orchestration, tracked separately); node/bun runs resolve in-process fine.
 */
export function shouldUseSubprocessPool(
  args: ShouldUseSubprocessPoolArgs,
): boolean {
  if (args.workers > 1) return true;
  return args.compiled && args.androidFlowCount === 0 && args.webFlowCount > 0;
}

export type ExecuteFlowsArgs = {
  ctx: CommandContext;
  deps: FlowsRunDeps;
  flags: FlowsRunFlags;
  flows: ResolvedFlow[];
  webFlows: WebResolvedFlow[];
  androidFlows: AndroidResolvedFlow[];
  webOptions: RunWebFlowOptions;
  androidOptions: RunAndroidFlowOptions;
};

export type ExecuteFlowsResult =
  | { counts: FlowCounts; durationMs: number }
  | { error: string };

/**
 * Runs the resolved flows through either the subprocess worker pool (compiled
 * binary, or `--workers > 1`) or the in-process path, returning the aggregate
 * counts or an error message to surface. Always shuts the android emulator down.
 */
export async function executeFlows(
  args: ExecuteFlowsArgs,
): Promise<ExecuteFlowsResult> {
  const { ctx, deps, flags, flows, webFlows, androidFlows } = args;
  const { webOptions, androidOptions } = args;

  const useSubprocessPool = shouldUseSubprocessPool({
    workers: flags.workers,
    compiled: process.env.QAWOLF_COMPILED === "true",
    webFlowCount: webFlows.length,
    androidFlowCount: androidFlows.length,
  });

  try {
    if (useSubprocessPool) {
      if (!deps.createPooledDispatch)
        throw new Error("createPooledDispatch is not wired for pooled runs");
      ctx.ui.outro(`Running ${pluralize(flows.length, "flow")}`);
      ctx.ui.write("\n");
      return await runFlowsPooled({
        flows: webFlows,
        workers: Math.max(1, flags.workers),
        bail: flags.bail,
        maxAttempts: flags.retries + 1,
        reporter: deps.reporter,
        now: deps.now,
        dispatch: deps.createPooledDispatch({ webOptions, androidOptions }),
      });
    }

    const bootError = await bootAndroidFlows(deps, androidFlows);
    if (bootError !== undefined) return { error: bootError };
    // Close the intro block and add a blank line before streamed test output.
    ctx.ui.outro(`Running ${pluralize(flows.length, "flow")}`);
    ctx.ui.write("\n");
    return await runFlows(flows, flags, deps, webOptions, androidOptions);
  } finally {
    deps.shutdownAndroid?.();
  }
}
