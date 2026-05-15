import { describe, expect, it } from "bun:test";
import { createConsoleReporter } from "./createConsoleReporter.js";
import type { RunSummary } from "./types.js";

// Assertions use toContain on visible substrings rather than toBe on full
// strings. styleText strips ANSI codes in non-TTY environments but this
// is not guaranteed across all CI configurations, so full-string equality
// would be fragile. Checking for visible text keeps assertions
// color-mode-agnostic.

function makeSink() {
  const calls: string[] = [];
  return { write: (str: string) => void calls.push(str), calls };
}

function make(columns?: number) {
  const out = makeSink();
  const err = makeSink();
  const r = createConsoleReporter({
    stdout: out,
    stderr: err,
    ...(columns !== undefined ? { columns } : {}),
  });
  return { out, err, r };
}

function makeSummary(overrides: Partial<RunSummary> = {}): RunSummary {
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

function makeFlowFail(
  overrides: {
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

describe("createConsoleReporter", () => {
  it("onFlowStart writes name and path to stdout", () => {
    const { out, r } = make();
    r.onFlowStart?.({ name: "My Flow", path: "src/flows/my.flow.ts" });
    expect(out.calls.join("")).toContain("My Flow");
    expect(out.calls.join("")).toContain("src/flows/my.flow.ts");
  });

  it("onTestResult with status pass writes label and ✓ to stdout", () => {
    const { out, r } = make();
    r.onTestResult?.({
      flowName: "F",
      flowPath: "p",
      label: "Click button",
      status: "pass",
      durationMs: 500,
    });
    const s = out.calls.join("");
    expect(s).toContain("Click button");
    expect(s).toContain("✓");
  });

  it("onTestResult with status fail writes label and ✗ to stdout", () => {
    const { out, r } = make();
    r.onTestResult?.({
      flowName: "F",
      flowPath: "p",
      label: "Click button",
      status: "fail",
      durationMs: 500,
    });
    const s = out.calls.join("");
    expect(s).toContain("Click button");
    expect(s).toContain("✗");
  });

  it("onScreenshot writes path to stdout", () => {
    const { out, r } = make();
    r.onScreenshot?.({ path: "screenshots/step.png" });
    const s = out.calls.join("");
    expect(s).toContain("Screenshot");
    expect(s).toContain("screenshots/step.png");
  });

  it("onFlowPass writes ✓, test counts, and duration to stdout", () => {
    const { out, r } = make();
    r.onFlowPass?.({
      name: "F",
      path: "p",
      tests: { passed: 2, total: 2 },
      durationMs: 1500,
    });
    const s = out.calls.join("");
    expect(s).toContain("✓");
    expect(s).toContain("2/2");
    expect(s).toContain("passed");
    expect(s).toContain("1.50s");
  });

  it("onFlowPass omits test counts when total is 0", () => {
    const { out, r } = make();
    r.onFlowPass?.({
      name: "F",
      path: "p",
      tests: { passed: 0, total: 0 },
      durationMs: 800,
    });
    const s = out.calls.join("");
    expect(s).toContain("✓");
    expect(s).not.toContain("0/0");
  });

  it("onFlowFail writes error message to stderr", () => {
    const { err, r } = make();
    r.onFlowFail?.(
      makeFlowFail({ err: new Error("assertion failed"), durationMs: 500 }),
    );
    expect(err.calls.join("")).toContain("Error: assertion failed");
  });

  it("onFlowFail writes ✗ and duration to stdout", () => {
    const { out, r } = make();
    r.onFlowFail?.(
      makeFlowFail({ err: new Error("assertion failed"), durationMs: 500 }),
    );
    const s = out.calls.join("");
    expect(s).toContain("✗");
    expect(s).toContain("0.50s");
  });

  it("onFlowFail writes retry message when attempt is less than maxAttempts", () => {
    const { out, r } = make();
    r.onFlowFail?.(makeFlowFail({ maxAttempts: 3 }));
    expect(out.calls.join("")).toContain("Retrying");
  });

  it("onFlowFail does not write retry message when attempt equals maxAttempts", () => {
    const { out, r } = make();
    r.onFlowFail?.(makeFlowFail({ attempt: 3, maxAttempts: 3 }));
    expect(out.calls.join("")).not.toContain("Retrying");
  });

  it("onFlowFail walks err.cause and prints each cause's message", () => {
    const { err, r } = make();
    const root = new Error("Cannot find package '@qawolf/flows'");
    const wrapped = new Error('Flow "Login" failed on attempt 1', {
      cause: root,
    });
    r.onFlowFail?.(makeFlowFail({ err: wrapped }));
    const s = err.calls.join("");
    expect(s).toContain('Flow "Login" failed on attempt 1');
    expect(s).toContain("Caused by:");
    expect(s).toContain("Cannot find package '@qawolf/flows'");
  });

  it("onFlowFail uses err.message when err.stack is undefined", () => {
    const { err, r } = make();
    const e = new Error("no stack");
    Object.defineProperty(e, "stack", { value: undefined });
    r.onFlowFail?.(makeFlowFail({ err: e }));
    expect(err.calls.join("")).toContain("Error: no stack");
  });

  it("onRunComplete writes flow summary when total is greater than 1", () => {
    const { out, r } = make();
    r.onRunComplete?.({
      summary: makeSummary({ flowsPassed: 2, flowsFailed: 1 }),
    });
    const s = out.calls.join("");
    expect(s).toContain("flows passed");
    expect(s).toContain("tests passed");
    expect(s).toContain("✗");
  });

  it("onRunComplete writes ✓ icon when all flows pass", () => {
    const { out, r } = make();
    r.onRunComplete?.({ summary: makeSummary({ flowsPassed: 2 }) });
    expect(out.calls.join("")).toContain("✓");
  });

  it("onRunComplete includes skipped count when flowsSkipped is greater than 0", () => {
    const { out, r } = make();
    r.onRunComplete?.({
      summary: makeSummary({ flowsPassed: 1, flowsSkipped: 1 }),
    });
    expect(out.calls.join("")).toContain("skipped");
  });

  it("onFlowFail omits test counts when total is 0", () => {
    const { out, r } = make();
    r.onFlowFail?.(makeFlowFail({ tests: { passed: 0, total: 0 } }));
    const s = out.calls.join("");
    expect(s).toContain("✗");
    expect(s).not.toContain("0/0");
  });

  it("onRunComplete does not write when total is 1", () => {
    const { out, r } = make();
    r.onRunComplete?.({ summary: makeSummary() });
    expect(out.calls).toHaveLength(0);
  });

  it("onRunComplete uses columns dep for separator width", () => {
    const { out, r } = make(10);
    r.onRunComplete?.({ summary: makeSummary({ flowsPassed: 2 }) });
    expect(out.calls.join("")).toContain("──────────");
  });
});
