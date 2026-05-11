import { afterEach, describe, expect, it, mock } from "bun:test";

import {
  callsOf,
  defaultFlags,
  failResult,
  makeCtx,
  makeDeps,
  makeReporter,
  passResult,
} from "./run.fixtures.js";
import { flowsRun } from "./run.js";

afterEach(() => {
  mock.restore();
});

describe("flowsRun dispatch", () => {
  it("fires onFlowStart, onFlowPass, and onRunComplete when one flow passes", async () => {
    const reporter = makeReporter();
    const deps = makeDeps({
      files: ["/a.flow.ts"],
      metaByFile: { "/a.flow.ts": { name: "Sign in", target: "Web - Chrome" } },
      runResults: [passResult({ passed: 2, total: 2 })],
      nowSequence: [100, 200, 300],
      reporter,
    });

    const result = await flowsRun(makeCtx(), undefined, defaultFlags(), deps);

    expect(result).toBeUndefined();
    expect(reporter.onFlowStart).toHaveBeenCalledWith({
      name: "Sign in",
      path: "/a.flow.ts",
    });
    expect(reporter.onFlowPass).toHaveBeenCalledWith({
      name: "Sign in",
      path: "/a.flow.ts",
      tests: { passed: 2, total: 2 },
      durationMs: 100,
    });
    expect(reporter.onFlowFail).not.toHaveBeenCalled();
    expect(reporter.onRunComplete).toHaveBeenCalledTimes(1);
    expect(reporter.onRunComplete).toHaveBeenCalledWith({
      summary: {
        flowsPassed: 1,
        flowsFailed: 0,
        flowsSkipped: 0,
        testsPassed: 2,
        testsTotal: 2,
        durationMs: 200,
        meta: {
          browsers: ["chromium"],
          workers: 1,
          headed: false,
          video: "off",
          trace: "off",
          har: "off",
        },
      },
    });
  });

  it("fires onFlowFail and returns error when one flow fails", async () => {
    const reporter = makeReporter();
    const deps = makeDeps({
      files: ["/a.flow.ts"],
      metaByFile: { "/a.flow.ts": { name: "Sign in", target: "Web - Chrome" } },
      runResults: [failResult()],
      reporter,
    });

    const result = await flowsRun(makeCtx(), undefined, defaultFlags(), deps);

    expect(result).toEqual({ error: "1 flow(s) failed" });
    expect(reporter.onFlowPass).not.toHaveBeenCalled();
    expect(reporter.onFlowFail).toHaveBeenCalledTimes(1);
    expect(reporter.onRunComplete).toHaveBeenCalledTimes(1);
  });

  it("uses path basename without extension as flow name when meta.name is missing", async () => {
    const reporter = makeReporter();
    const deps = makeDeps({
      files: ["/path/to/login.flow.ts"],
      metaByFile: { "/path/to/login.flow.ts": { target: "Web - Chrome" } },
      runResults: [passResult()],
      reporter,
    });

    await flowsRun(makeCtx(), undefined, defaultFlags(), deps);

    expect(reporter.onFlowStart).toHaveBeenCalledWith({
      name: "login",
      path: "/path/to/login.flow.ts",
    });
  });

  it("calls runWebFlow once per matched web flow with the same runWebFlowDeps", async () => {
    const deps = makeDeps({
      files: ["/c.flow.ts", "/f.flow.ts", "/w.flow.ts"],
      metaByFile: {
        "/c.flow.ts": { target: "Web - Chrome" },
        "/f.flow.ts": { target: "Web - Firefox" },
        "/w.flow.ts": { target: "Web - Safari" },
      },
      runResults: [passResult(), passResult(), passResult()],
    });

    await flowsRun(makeCtx(), undefined, defaultFlags(), deps);

    const calls = callsOf(deps.runWebFlow);
    expect(calls.length).toBe(3);
    const flowPaths = calls.map(
      (args) => (args[0] as { flowPath: string }).flowPath,
    );
    expect(flowPaths).toEqual(["/c.flow.ts", "/f.flow.ts", "/w.flow.ts"]);
    for (const args of calls) {
      const callArg = args[0] as {
        deps: unknown;
        options: Record<string, unknown>;
      };
      expect(callArg.deps).toBe(deps.runWebFlowDeps);
      expect(callArg.options).not.toHaveProperty("browser");
    }
  });

  it("marks remaining flows as skipped when --bail is true and a flow fails", async () => {
    const reporter = makeReporter();
    const deps = makeDeps({
      files: ["/a", "/b", "/c"],
      metaByFile: {
        "/a": { target: "Web - Chrome" },
        "/b": { target: "Web - Chrome" },
        "/c": { target: "Web - Chrome" },
      },
      runResults: [passResult(), failResult(), passResult()],
      reporter,
    });
    const flags = { ...defaultFlags(), bail: true };

    const result = await flowsRun(makeCtx(), undefined, flags, deps);

    expect(callsOf(deps.runWebFlow).length).toBe(2);
    expect(result).toEqual({ error: "1 flow(s) failed" });
    const completeCall = callsOf(reporter.onRunComplete!)[0]?.[0] as {
      summary: {
        flowsPassed: number;
        flowsFailed: number;
        flowsSkipped: number;
      };
    };
    expect(completeCall.summary.flowsPassed).toBe(1);
    expect(completeCall.summary.flowsFailed).toBe(1);
    expect(completeCall.summary.flowsSkipped).toBe(1);
  });

  it("runs all flows when --bail is false even if one fails", async () => {
    const reporter = makeReporter();
    const deps = makeDeps({
      files: ["/a", "/b", "/c"],
      metaByFile: {
        "/a": { target: "Web - Chrome" },
        "/b": { target: "Web - Chrome" },
        "/c": { target: "Web - Chrome" },
      },
      runResults: [passResult(), failResult(), passResult()],
      reporter,
    });

    const result = await flowsRun(makeCtx(), undefined, defaultFlags(), deps);

    expect(callsOf(deps.runWebFlow).length).toBe(3);
    expect(result).toEqual({ error: "1 flow(s) failed" });
    const completeCall = callsOf(reporter.onRunComplete!)[0]?.[0] as {
      summary: {
        flowsPassed: number;
        flowsFailed: number;
        flowsSkipped: number;
      };
    };
    expect(completeCall.summary.flowsPassed).toBe(2);
    expect(completeCall.summary.flowsFailed).toBe(1);
    expect(completeCall.summary.flowsSkipped).toBe(0);
  });

  it("treats a thrown runWebFlow as a flow failure and continues dispatch", async () => {
    const reporter = makeReporter();
    const deps = makeDeps({
      files: ["/a", "/b"],
      metaByFile: {
        "/a": { target: "Web - Chrome" },
        "/b": { target: "Web - Chrome" },
      },
      runResults: [passResult(), passResult()],
      reporter,
    });
    (deps as { runWebFlow: typeof deps.runWebFlow }).runWebFlow = mock<
      typeof deps.runWebFlow
    >(() => Promise.reject(new Error("malformed flow")));

    const result = await flowsRun(makeCtx(), undefined, defaultFlags(), deps);

    expect(callsOf(deps.runWebFlow).length).toBe(2);
    expect(reporter.onFlowFail).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ error: "2 flow(s) failed" });
    expect(reporter.onRunComplete).toHaveBeenCalledTimes(1);
  });
});
