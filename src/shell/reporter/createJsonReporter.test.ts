import { describe, expect, it } from "bun:test";
import { createJsonReporter } from "./createJsonReporter.js";
import type { RunSummary } from "./types.js";

function makeSink() {
  const calls: string[] = [];
  return { write: (str: string) => void calls.push(str), calls };
}

function make() {
  const out = makeSink();
  const r = createJsonReporter({ stdout: out });
  return { out, r };
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

function parseLines(out: { calls: string[] }): unknown[] {
  const joined = out.calls.join("");
  return joined
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

describe("createJsonReporter", () => {
  it("onFlowStart emits a single ND-JSON line with type flow.start", () => {
    const { out, r } = make();
    r.onFlowStart?.({ name: "Login", path: "src/flows/login.flow.ts" });
    expect(out.calls.join("").endsWith("\n")).toBe(true);
    const events = parseLines(out);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: "flow.start",
      name: "Login",
      path: "src/flows/login.flow.ts",
    });
  });

  it("onFlowPass includes test counts and duration", () => {
    const { out, r } = make();
    r.onFlowPass?.({
      name: "Login",
      path: "p",
      tests: { passed: 3, total: 3 },
      durationMs: 1234,
    });
    const events = parseLines(out);
    expect(events[0]).toEqual({
      type: "flow.pass",
      name: "Login",
      path: "p",
      tests: { passed: 3, total: 3 },
      durationMs: 1234,
    });
  });

  it("onFlowPass includes stamp when manifest is provided", () => {
    const { out, r } = make();
    r.onFlowPass?.({
      name: "Login",
      path: "p",
      tests: { passed: 1, total: 1 },
      durationMs: 100,
      manifest: { envId: "env-abc", contentHash: "deadbeefcafebabe" } as never,
    });
    const events = parseLines(out) as Record<string, unknown>[];
    expect(events[0]?.["stamp"]).toEqual({
      envId: "env-abc",
      contentHash: "deadbeefcafebabe",
    });
  });

  it("onFlowFail flattens err.cause chain into an array", () => {
    const { out, r } = make();
    const root = new Error("Cannot find package '@qawolf/flows'");
    const wrapped = new Error('Flow "Login" failed on attempt 1', {
      cause: root,
    });
    r.onFlowFail?.({
      name: "Login",
      path: "p",
      err: wrapped,
      tests: { passed: 0, total: 1 },
      durationMs: 500,
      attempt: 1,
      maxAttempts: 3,
    });
    const events = parseLines(out) as Record<string, unknown>[];
    expect(events[0]?.["type"]).toBe("flow.fail");
    expect(events[0]?.["attempt"]).toBe(1);
    expect(events[0]?.["maxAttempts"]).toBe(3);
    const errors = events[0]?.["error"] as Record<string, unknown>[];
    expect(errors).toHaveLength(2);
    expect(errors[0]?.["message"]).toBe('Flow "Login" failed on attempt 1');
    expect(errors[1]?.["message"]).toBe("Cannot find package '@qawolf/flows'");
  });

  it("onFlowFail handles non-Error causes", () => {
    const { out, r } = make();
    const wrapped = new Error("outer", { cause: "raw string cause" });
    r.onFlowFail?.({
      name: "F",
      path: "p",
      err: wrapped,
      tests: { passed: 0, total: 0 },
      durationMs: 1,
      attempt: 1,
      maxAttempts: 1,
    });
    const events = parseLines(out) as Record<string, unknown>[];
    const errors = events[0]?.["error"] as Record<string, unknown>[];
    expect(errors[1]?.["message"]).toBe("raw string cause");
  });

  it("onRunComplete emits run.complete with summary", () => {
    const { out, r } = make();
    const summary = makeSummary({ flowsPassed: 2, flowsFailed: 1 });
    r.onRunComplete?.({ summary });
    const events = parseLines(out) as Record<string, unknown>[];
    expect(events[0]?.["type"]).toBe("run.complete");
    expect(events[0]?.["summary"]).toEqual(summary);
  });

  it("does not emit anything for onTestStart, onTestResult, or onScreenshot", () => {
    const { out, r } = make();
    r.onTestStart?.({ flowName: "F", flowPath: "p", label: "step" });
    r.onTestResult?.({
      flowName: "F",
      flowPath: "p",
      label: "step",
      status: "pass",
      durationMs: 1,
    });
    r.onScreenshot?.({ path: "x.png" });
    expect(out.calls).toHaveLength(0);
  });

  it("emits one ND-JSON line per call across mixed events", () => {
    const { out, r } = make();
    r.onFlowStart?.({ name: "A", path: "a" });
    r.onFlowPass?.({
      name: "A",
      path: "a",
      tests: { passed: 1, total: 1 },
      durationMs: 1,
    });
    r.onRunComplete?.({ summary: makeSummary() });
    const events = parseLines(out);
    expect(events).toHaveLength(3);
  });
});
