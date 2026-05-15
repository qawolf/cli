import { InvalidArgumentError } from "commander";

import type {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
} from "~/commands/flows/expand.js";
import type { CommandContext } from "~/lib/context.js";
import type { Reporter } from "~/lib/reporter/types.js";
import { FlowRunError } from "~/lib/runner/errors.js";
import type {
  RunAndroidFlowDeps,
  RunAndroidFlowOptions,
  runAndroidFlow as defaultRunAndroidFlow,
} from "~/lib/runner/runAndroidFlow.js";
import type {
  RunWebFlowDeps,
  RunWebFlowOptions,
  runWebFlow as defaultRunWebFlow,
} from "~/lib/runner/runWebFlow.js";
import type { FlowRunResult } from "~/lib/runner/types.js";
import type { BrowserName, TraceMode, VideoMode } from "~/types.js";

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
  readonly cwd: string;
  readonly expandPatterns: typeof defaultExpandPatterns;
  readonly peekFlowMeta: typeof defaultPeekFlowMeta;
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
};

export type WebResolvedFlow = {
  readonly kind: "web";
  readonly file: string;
  readonly name: string;
  readonly browser: BrowserName;
};

type AndroidResolvedFlow = {
  readonly kind: "android";
  readonly file: string;
  readonly name: string;
  readonly target: string;
};

export type ResolvedFlow = WebResolvedFlow | AndroidResolvedFlow;

export function unsupportedTargetMessage(target: string): string {
  return `${target} targets aren't supported in v0.1. Run them on app.qawolf.com or wait for v0.2.`;
}

// Strict integer parser. `String(n) !== value` rejects `"+3"`, leading zeros
// like `"03"`, and the JS oddity `"-0"` (String(-0) === "0") — same convention
// as most CLI tooling. The optional `min` bound surfaces domain errors
// (negative retries, zero workers, etc.) at parse time rather than deeper.
export function parseInteger(
  name: string,
  options: { min?: number } = {},
): (value: string) => number {
  return (value) => {
    const n = Number.parseInt(value, 10);
    if (!Number.isFinite(n) || String(n) !== value) {
      throw new InvalidArgumentError(`${name} must be an integer`);
    }
    if (options.min !== undefined && n < options.min) {
      throw new InvalidArgumentError(`${name} must be >= ${options.min}`);
    }
    return n;
  };
}

export function parseEnum<T extends string>(
  name: string,
  values: readonly T[],
): (value: string) => T {
  return (value) => {
    if (!(values as readonly string[]).includes(value)) {
      throw new InvalidArgumentError(
        `${name} must be one of: ${values.join(", ")}`,
      );
    }
    return value as T;
  };
}

export async function dispatchFlow({
  deps,
  flow,
  reporter,
  webOptions,
  androidOptions,
}: {
  deps: FlowsRunDeps;
  flow: ResolvedFlow;
  reporter: Reporter;
  webOptions: RunWebFlowOptions;
  androidOptions: RunAndroidFlowOptions;
}): Promise<{ run: FlowRunResult; durationMs: number }> {
  reporter.onFlowStart?.({ name: flow.name, path: flow.file });
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
  return { run, durationMs: deps.now() - flowStart };
}
