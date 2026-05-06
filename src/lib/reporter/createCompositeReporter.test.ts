import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { createCompositeReporter } from "./createCompositeReporter.js";
import type { Reporter } from "./types.js";

afterEach(() => {
  mock.restore();
});

const FLOW_START_EVENT = { name: "Flow A", path: "src/flows/a.flow.ts" };
const FLOW_PASS_EVENT = {
  name: "Flow A",
  path: "src/flows/a.flow.ts",
  tests: { passed: 1, total: 1 },
  durationMs: 500,
};
const FLOW_FAIL_EVENT = {
  name: "Flow A",
  path: "src/flows/a.flow.ts",
  err: new Error("boom"),
  tests: { passed: 0, total: 1 },
  durationMs: 300,
  attempt: 1,
  maxAttempts: 1,
};
const RUN_COMPLETE_EVENT = {
  summary: {
    flowsPassed: 1,
    flowsFailed: 0,
    flowsSkipped: 0,
    testsPassed: 1,
    testsTotal: 1,
    durationMs: 500,
    meta: {
      browser: "chromium" as const,
      workers: 1,
      headed: false,
      video: "off" as const,
      trace: "off" as const,
      har: "off" as const,
    },
  },
};

function makeChild(calls: string[]): Reporter {
  return {
    onFlowStart: (e) => {
      calls.push(`start:${e.name}`);
    },
    onFlowPass: (e) => {
      calls.push(`pass:${e.name}`);
    },
    onFlowFail: (e) => {
      calls.push(`fail:${e.name}`);
    },
    onTestStart: (e) => {
      calls.push(`testStart:${e.label}`);
    },
    onTestResult: (e) => {
      calls.push(`testResult:${e.label}`);
    },
    onScreenshot: (e) => {
      calls.push(`screenshot:${e.path}`);
    },
    onRunComplete: () => {
      calls.push("complete");
    },
  };
}

describe("createCompositeReporter", () => {
  it("forwards onFlowStart to both reporters", () => {
    const calls1: string[] = [];
    const calls2: string[] = [];
    const r = createCompositeReporter([makeChild(calls1), makeChild(calls2)]);
    r.onFlowStart?.(FLOW_START_EVENT);
    expect(calls1).toContain("start:Flow A");
    expect(calls2).toContain("start:Flow A");
  });

  it("forwards all event types to all reporters in order", () => {
    const calls1: string[] = [];
    const calls2: string[] = [];
    const r = createCompositeReporter([makeChild(calls1), makeChild(calls2)]);
    r.onFlowStart?.(FLOW_START_EVENT);
    r.onFlowPass?.(FLOW_PASS_EVENT);
    r.onFlowFail?.(FLOW_FAIL_EVENT);
    r.onRunComplete?.(RUN_COMPLETE_EVENT);
    const expected = ["start:Flow A", "pass:Flow A", "fail:Flow A", "complete"];
    expect(calls1).toEqual(expected);
    expect(calls2).toEqual(expected);
  });

  it("a throwing inner reporter does not prevent other reporters from receiving callbacks", () => {
    // mockImplementation returns true to match process.stderr.write's boolean return type
    spyOn(process.stderr, "write").mockImplementation(() => true);
    const calls: string[] = [];
    const throwing: Reporter = {
      onFlowStart: () => {
        throw new Error("boom");
      },
    };
    const good = makeChild(calls);
    const r = createCompositeReporter([throwing, good]);
    r.onFlowStart?.(FLOW_START_EVENT);
    expect(calls).toContain("start:Flow A");
  });

  it("a throwing inner reporter logs error to stderr", () => {
    // mockImplementation returns true to match process.stderr.write's boolean return type
    const stderrSpy = spyOn(process.stderr, "write").mockImplementation(
      () => true,
    );
    const throwing: Reporter = {
      onFlowStart: () => {
        throw new Error("boom");
      },
    };
    const r = createCompositeReporter([throwing]);
    r.onFlowStart?.(FLOW_START_EVENT);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("boom"));
  });

  it("works with an empty reporters array", () => {
    const r = createCompositeReporter([]);
    expect(() => r.onFlowStart?.(FLOW_START_EVENT)).not.toThrow();
  });

  it("reporters that do not implement a callback are skipped", () => {
    const calls: string[] = [];
    const partial: Reporter = {
      onFlowPass: (e) => {
        calls.push(e.name);
      },
    };
    const r = createCompositeReporter([partial]);
    r.onFlowStart?.(FLOW_START_EVENT);
    expect(calls).toHaveLength(0);
  });
});
