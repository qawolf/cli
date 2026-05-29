import { createConsoleReporter } from "./createConsoleReporter.js";
import type { RunSummary } from "./types.js";

/** A write sink that records everything written, for asserting reporter output. */
export function makeSink() {
  const calls: string[] = [];
  return { write: (str: string) => void calls.push(str), calls };
}

/** A console reporter wired to capturing stdout/stderr sinks. */
export function makeConsoleHarness(columns?: number) {
  const out = makeSink();
  const err = makeSink();
  const r = createConsoleReporter({
    stdout: out,
    stderr: err,
    ...(columns !== undefined ? { columns } : {}),
  });
  return { out, err, r };
}

export function makeSummary(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    flowsPassed: 1,
    flowsFailed: 0,
    flowsSkipped: 0,
    testsPassed: 1,
    testsTotal: 1,
    durationMs: 1000,
    meta: {
      browsers: ["chromium"],
      workers: 1,
      headed: false,
      video: "off",
      trace: "off",
      har: "off",
    },
    ...overrides,
  };
}

export function makeFlowFail(
  overrides: {
    name?: string;
    path?: string;
    err?: Error;
    durationMs?: number;
    attempt?: number;
    maxAttempts?: number;
    tests?: { passed: number; total: number };
  } = {},
) {
  return {
    name: "F",
    path: "p",
    err: new Error("fail"),
    tests: { passed: 0, total: 1 },
    durationMs: 300,
    attempt: 1,
    maxAttempts: 1,
    ...overrides,
  };
}
