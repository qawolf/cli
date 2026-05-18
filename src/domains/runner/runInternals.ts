import type { CommandContext } from "~/shell/commandContext.js";
import type { findFlowStamp as defaultFindFlowStamp } from "~/shell/manifest/lookup.js";
import type { Reporter } from "~/shell/reporter/types.js";
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
import type { FlowRunResult } from "./types.js";
import type { BrowserName, TraceMode, VideoMode } from "~/core/types.js";

export type FlowsRunFlags = {
  readonly retries: number;
  readonly bail: boolean;
  readonly workers: number;
  readonly timeout: number;
  readonly video: VideoMode;
  readonly trace: TraceMode;
  readonly outputDir: string;
};

export type FlowsRunDeps = {
  readonly peekFlowMeta: (
    filePath: string,
  ) => Promise<{ name: string | undefined; target: string | undefined }>;
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

export function unsupportedTargetMessage(target: string): string {
  return `${target} targets aren't supported in v0.1. Run them on app.qawolf.com or wait for v0.2.`;
}

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
  deps.reporter.onFlowStart?.({ name: flow.name, path: flow.file });
  const flowStart = deps.now();
  let run: FlowRunResult;
  try {
    if (flow.kind === "web") {
      run = await deps.runWebFlow({
        deps: deps.runWebFlowDeps,
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
        deps: deps.runAndroidFlowDeps,
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
    deps.warn(`failed to read manifest stamp for ${flow.file}: ${message}`);
  }
  if (stamp) run = { ...run, manifest: stamp };
  return { run, durationMs: deps.now() - flowStart };
}
