import { InvalidArgumentError } from "commander";

import type {
  expandPatterns as defaultExpandPatterns,
  peekFlowMeta as defaultPeekFlowMeta,
} from "~/commands/flows/expand.js";
import type { CommandContext } from "~/lib/context.js";
import type { Reporter } from "~/lib/reporter/types.js";
import { FlowRunError } from "~/lib/runner/errors.js";
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
  readonly reporter: Reporter;
  readonly now: () => number;
};

export type ResolvedFlow = {
  readonly file: string;
  readonly name: string;
  readonly browser: BrowserName;
};

export function unsupportedTargetMessage(target: string): string {
  if (target.startsWith("Android - ")) {
    return "Android targets aren't yet implemented in v0.1; tracked in WIZ-10446.";
  }
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

export async function dispatchFlow(
  flow: ResolvedFlow,
  options: RunWebFlowOptions,
  deps: FlowsRunDeps,
): Promise<{ run: FlowRunResult; durationMs: number }> {
  deps.reporter.onFlowStart?.({ name: flow.name, path: flow.file });
  const flowStart = deps.now();
  let run: FlowRunResult;
  try {
    run = await deps.runWebFlow({
      deps: deps.runWebFlowDeps,
      options,
      flowPath: flow.file,
    });
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
