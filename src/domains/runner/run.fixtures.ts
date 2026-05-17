import { mock } from "bun:test";

import type { CommandContext } from "~/shell/commandContext.js";
import type { Reporter } from "~/shell/reporter/types.js";
import type { FlowRunError } from "~/domains/runner/errors.js";
import type { RunWebFlowDeps } from "~/domains/runner/runWebFlow.js";
import type { FlowRunResult } from "~/domains/runner/types.js";
import type { UI } from "~/shell/ui/index.js";

import type { RunAndroidFlowDeps } from "~/domains/runner/runAndroidFlow.js";

import type { FlowsRunDeps, FlowsRunFlags } from "./runInternals.js";

export const fakeCwd = "/proj";

// Note: this duplicates `makeFakeUI` from `src/commands/install/browsers.fixtures.ts`.
// Lift to a shared `~/lib/test/ui.ts` (or similar) when a third file needs it.
export function makeFakeUI(): UI {
  return {
    mode: "human",
    gap: mock(() => {}),
    intro: mock(() => {}),
    note: mock(() => {}),
    outro: mock(() => {}),
    confirm: mock(() => Promise.resolve({ ok: false } as const)),
    password: mock(() => Promise.resolve({ ok: false } as const)),
    withProgress: mock(() =>
      Promise.resolve([]),
    ) as unknown as UI["withProgress"],
    step: mock(() => {}),
    success: mock(() => {}),
    warn: mock(() => {}),
    cancel: mock(() => {}),
    json: mock(() => {}),
    output: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
    write: mock(() => {}),
  };
}

export const makeCtx = (ui: UI = makeFakeUI()): CommandContext => ({
  ui,
  configDir: "/tmp/test-config",
  outputMode: "human",
  isInteractive: false,
  apiBaseUrl: "https://example.invalid",
});

export function makeReporter(): Reporter {
  return {
    onFlowStart: mock(() => {}),
    onFlowPass: mock(() => {}),
    onFlowFail: mock(() => {}),
    onTestStart: mock(() => {}),
    onTestResult: mock(() => {}),
    onScreenshot: mock(() => {}),
    onRunComplete: mock(() => {}),
  };
}

export function makeFakeRunWebFlowDeps(): RunWebFlowDeps {
  return {} as RunWebFlowDeps;
}

export function makeFakeRunAndroidFlowDeps(): RunAndroidFlowDeps {
  return {} as RunAndroidFlowDeps;
}

export function defaultFlags(): FlowsRunFlags {
  return {
    retries: 0,
    bail: false,
    workers: 1,
    timeout: 30_000,
    video: "off",
    trace: "off",
    outputDir: "qawolf-output",
  };
}

type DepsOverrides = {
  files?: readonly string[];
  metaByFile?: Record<string, { name?: string; target?: string }>;
  installError?: Error;
  runResults?: FlowRunResult[];
  nowSequence?: readonly number[];
  reporter?: Reporter;
  androidFlowDeps?: RunAndroidFlowDeps;
};

export function makeDeps(overrides: DepsOverrides = {}): FlowsRunDeps {
  const files = overrides.files ?? [];
  const metaByFile = overrides.metaByFile ?? {};
  const runResults = overrides.runResults ?? [];
  let runIdx = 0;
  const nowSeq = overrides.nowSequence ?? [0];
  let nowIdx = 0;
  return {
    cwd: fakeCwd,
    expandPatterns: mock<FlowsRunDeps["expandPatterns"]>(() =>
      Promise.resolve([...files]),
    ),
    peekFlowMeta: mock<FlowsRunDeps["peekFlowMeta"]>((file: string) =>
      Promise.resolve({
        name: metaByFile[file]?.name,
        target: metaByFile[file]?.target,
      }),
    ),
    installBrowsers: mock<FlowsRunDeps["installBrowsers"]>(() =>
      overrides.installError
        ? Promise.reject(overrides.installError)
        : Promise.resolve(),
    ),
    runWebFlow: mock<FlowsRunDeps["runWebFlow"]>(() =>
      Promise.resolve(
        runResults[runIdx++] ?? runResults[runResults.length - 1]!,
      ),
    ),
    runWebFlowDeps: makeFakeRunWebFlowDeps(),
    runAndroidFlow: mock<FlowsRunDeps["runAndroidFlow"]>(() =>
      Promise.resolve(
        runResults[runIdx++] ?? runResults[runResults.length - 1]!,
      ),
    ),
    runAndroidFlowDeps: overrides.androidFlowDeps ?? "not-wired",
    reporter: overrides.reporter ?? makeReporter(),
    now: mock<() => number>(
      () => nowSeq[Math.min(nowIdx++, nowSeq.length - 1)]!,
    ),
  };
}

export function passResult(
  testCounts: { passed: number; total: number } = { passed: 1, total: 1 },
): FlowRunResult {
  return { passed: true, testCounts, attempts: 1 };
}

export function failResult(
  cause: Error = new Error("flow failed"),
  testCounts: { passed: number; total: number } = { passed: 0, total: 1 },
): FlowRunResult {
  return {
    passed: false,
    testCounts,
    attempts: 1,
    error: Object.assign(new Error("Flow failed on attempt 1"), {
      flowName: "test",
      attempt: 1,
      cause,
    }) as unknown as FlowRunError,
  };
}

export const callsOf = <T extends (...args: never) => unknown>(
  fn: T,
): unknown[][] => (fn as unknown as ReturnType<typeof mock>).mock.calls;
