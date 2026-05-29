import type { CommandContext } from "~/shell/commandContext.js";
import type { findFlowStamp as defaultFindFlowStamp } from "~/shell/manifest/lookup.js";
import type { Logger } from "~/shell/logger.js";
import type { Reporter } from "~/shell/reporter/types.js";
import { runnerMessages } from "~/core/messages/index.js";
import { FlowRunError } from "./errors.js";
import type {
  RunAndroidFlowDeps,
  RunAndroidFlowOptions,
  runAndroidFlow as defaultRunAndroidFlow,
} from "./runAndroidFlow.js";
import type {
  RunWebFlowDeps,
  RunWebFlowOptions,
  runWebFlow as defaultRunWebFlow,
} from "./runWebFlow.js";
import type { PooledDispatch } from "./runFlowsPooled.js";
import type { FlowRunResult } from "./types.js";
import type {
  BrowserName,
  HarContent,
  HarMode,
  TraceMode,
  VideoMode,
} from "~/core/types.js";
import type { PeekFlowMetaFn } from "~/core/flowMeta.js";

export type FlowsRunFlags = {
  readonly retries: number;
  readonly bail: boolean;
  readonly workers: number;
  readonly timeout: number;
  readonly video: VideoMode;
  readonly trace: TraceMode;
  readonly har: HarMode;
  readonly harContent: HarContent;
  readonly outputDir: string;
  readonly headed: boolean;
};

export type FlowsRunDeps = {
  readonly peekFlowMeta: PeekFlowMetaFn;
  readonly installBrowsers: (
    ctx: CommandContext,
    browsers: BrowserName[],
  ) => Promise<void>;
  readonly runWebFlow: typeof defaultRunWebFlow;
  readonly runWebFlowDeps: RunWebFlowDeps;
  readonly runAndroidFlow: typeof defaultRunAndroidFlow;
  readonly runAndroidFlowDeps: RunAndroidFlowDeps | "not-wired";
  readonly reporter: Reporter;
  readonly now: () => number;
  readonly findFlowStamp: typeof defaultFindFlowStamp;
  readonly warn: (message: string) => void;
  readonly logger?: Logger;
  /** Builds the subprocess-backed dispatch for `--workers > 1` (pooled path only). */
  readonly createPooledDispatch?: (opts: {
    webOptions: RunWebFlowOptions;
    androidOptions: RunAndroidFlowOptions;
  }) => PooledDispatch;
  /** Boots the AVDs for the given names before any android flows are dispatched. */
  readonly bootAndroid?: (avdNames: string[]) => Promise<void>;
  /** Stops the Appium server and emulator pool after all flows complete. */
  readonly shutdownAndroid?: () => void;
};

export type WebResolvedFlow = {
  readonly kind: "web";
  readonly file: string;
  readonly name: string;
  readonly browser: BrowserName;
};

export type AndroidResolvedFlow = {
  readonly kind: "android";
  readonly file: string;
  readonly name: string;
  readonly target: string;
};

export type ResolvedFlow = WebResolvedFlow | AndroidResolvedFlow;

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
        throw new Error(
          "Android flow dispatch requires wired AndroidLaunchDeps; " +
            "tracked in WIZ-10343",
        );
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
  // Stamping is supplementary diagnostic info — surface I/O failures via
  // deps.warn so the user/support can see them, but never let a lookup
  // error erase the flow's pass/fail outcome.
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
  const attempts = run.attempts;
  deps.logger?.info(
    `${outcome}: ${flow.name} (${durationMs}ms, ${attempts} attempt${attempts === 1 ? "" : "s"})`,
  );
  return { run, durationMs };
}
