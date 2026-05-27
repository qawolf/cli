import { describe, expect, it } from "bun:test";
import { createAgentReporter } from "./createAgentReporter.js";
import type { RunSummary } from "./types.js";

// Match the ESC + [ + params + final letter pattern that defines ANSI
// SGR/CSI sequences. Constructed at runtime so the source itself is
// ANSI-free (oxlint flags literal ESC bytes in source).
const ansiRe = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`);

function makeSink() {
  const calls: string[] = [];
  return { write: (str: string) => void calls.push(str), calls };
}

function make() {
  const err = makeSink();
  const r = createAgentReporter({ stderr: err });
  return { err, r };
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

describe("createAgentReporter", () => {
  it("writes only to stderr and never emits ANSI codes", () => {
    const { err, r } = make();
    r.onFlowStart?.({ name: "Login", path: "p" });
    r.onFlowPass?.({
      name: "Login",
      path: "p",
      tests: { passed: 1, total: 1 },
      durationMs: 100,
    });
    r.onFlowFail?.({
      name: "Login",
      path: "p",
      err: new Error("boom"),
      tests: { passed: 0, total: 1 },
      durationMs: 200,
      attempt: 1,
      maxAttempts: 1,
    });
    r.onRunComplete?.({
      summary: makeSummary({ flowsPassed: 1, flowsFailed: 1 }),
    });
    const all = err.calls.join("");
    expect(ansiRe.test(all)).toBe(false);
  });

  it("onFlowStart writes name and path", () => {
    const { err, r } = make();
    r.onFlowStart?.({ name: "Login", path: "src/flows/login.flow.ts" });
    const s = err.calls.join("");
    expect(s).toContain("Login");
    expect(s).toContain("src/flows/login.flow.ts");
  });

  it("onFlowPass writes name, PASS keyword, counts, and duration", () => {
    const { err, r } = make();
    r.onFlowPass?.({
      name: "Login",
      path: "p",
      tests: { passed: 2, total: 2 },
      durationMs: 1500,
    });
    const s = err.calls.join("");
    expect(s).toContain("PASS");
    expect(s).toContain("Login");
    expect(s).toContain("2/2");
    expect(s).toContain("1.50s");
  });

  it("onFlowPass omits test counts when total is 0", () => {
    const { err, r } = make();
    r.onFlowPass?.({
      name: "F",
      path: "p",
      tests: { passed: 0, total: 0 },
      durationMs: 100,
    });
    expect(err.calls.join("")).not.toContain("0/0");
  });

  it("onFlowFail writes FAIL keyword, name, counts, duration, and error message", () => {
    const { err, r } = make();
    r.onFlowFail?.({
      name: "Login",
      path: "p",
      err: new Error("assertion failed"),
      tests: { passed: 0, total: 1 },
      durationMs: 500,
      attempt: 1,
      maxAttempts: 1,
    });
    const s = err.calls.join("");
    expect(s).toContain("FAIL");
    expect(s).toContain("Login");
    expect(s).toContain("0/1");
    expect(s).toContain("0.50s");
    expect(s).toContain("assertion failed");
  });

  it("onFlowFail writes nested cause chain", () => {
    const { err, r } = make();
    const root = new Error("Cannot find package '@qawolf/flows'");
    const wrapped = new Error('Flow "Login" failed on attempt 1', {
      cause: root,
    });
    r.onFlowFail?.({
      name: "Login",
      path: "p",
      err: wrapped,
      tests: { passed: 0, total: 1 },
      durationMs: 100,
      attempt: 1,
      maxAttempts: 1,
    });
    const s = err.calls.join("");
    expect(s).toContain('Flow "Login" failed on attempt 1');
    expect(s).toContain("Caused by:");
    expect(s).toContain("Cannot find package '@qawolf/flows'");
  });

  it("onFlowFail writes retry line when attempt is less than maxAttempts", () => {
    const { err, r } = make();
    r.onFlowFail?.({
      name: "Login",
      path: "p",
      err: new Error("flaky"),
      tests: { passed: 0, total: 1 },
      durationMs: 100,
      attempt: 1,
      maxAttempts: 3,
    });
    const s = err.calls.join("");
    expect(s).toContain("RETRY");
    expect(s).toContain("1/3");
  });

  it("onFlowFail does not write retry line when attempt equals maxAttempts", () => {
    const { err, r } = make();
    r.onFlowFail?.({
      name: "Login",
      path: "p",
      err: new Error("done"),
      tests: { passed: 0, total: 1 },
      durationMs: 100,
      attempt: 3,
      maxAttempts: 3,
    });
    expect(err.calls.join("")).not.toContain("RETRY");
  });

  it("onRunComplete writes SUMMARY line with flow and test counts", () => {
    const { err, r } = make();
    r.onRunComplete?.({
      summary: makeSummary({ flowsPassed: 2, flowsFailed: 1 }),
    });
    const s = err.calls.join("");
    expect(s).toContain("SUMMARY");
    expect(s).toContain("2/3 flows passed");
    expect(s).toContain("tests passed");
  });

  it("onRunComplete includes skipped count when flowsSkipped is greater than 0", () => {
    const { err, r } = make();
    r.onRunComplete?.({
      summary: makeSummary({ flowsPassed: 1, flowsSkipped: 2 }),
    });
    expect(err.calls.join("")).toContain("skipped");
  });

  it("onRunComplete still emits the summary even when only one flow ran", () => {
    const { err, r } = make();
    r.onRunComplete?.({ summary: makeSummary() });
    const s = err.calls.join("");
    expect(s).toContain("SUMMARY");
    expect(s).toContain("1/1");
  });

  it("does not emit anything for onTestStart, onTestResult, or onScreenshot", () => {
    const { err, r } = make();
    r.onTestStart?.({ flowName: "F", flowPath: "p", label: "step" });
    r.onTestResult?.({
      flowName: "F",
      flowPath: "p",
      label: "step",
      status: "pass",
      durationMs: 1,
    });
    r.onScreenshot?.({ path: "x.png" });
    expect(err.calls).toHaveLength(0);
  });
});
