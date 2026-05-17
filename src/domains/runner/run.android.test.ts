import { afterEach, describe, expect, it, mock } from "bun:test";

import type { RunSummary } from "~/shell/reporter/types.js";

import {
  callsOf,
  defaultFlags,
  makeCtx,
  makeDeps,
  makeFakeRunAndroidFlowDeps,
  makeReporter,
  passResult,
} from "./run.fixtures.js";
import { flowsRun } from "./run.js";

afterEach(() => {
  mock.restore();
});

describe("flowsRun Android dispatch", () => {
  it("treats an Android flow as a flow failure when runAndroidFlowDeps is not wired", async () => {
    const reporter = makeReporter();
    const deps = makeDeps({
      metaByFile: { "/a.ts": { target: "Android - Pixel" } },
      reporter,
    });
    const result = await flowsRun(makeCtx(), ["/a.ts"], defaultFlags(), deps);
    expect(result).toEqual({ error: "1 flow(s) failed" });
    expect(reporter.onFlowFail).toHaveBeenCalledTimes(1);
    const failCall = callsOf(reporter.onFlowFail!)[0]?.[0] as { err: Error };
    expect((failCall.err.cause as Error).message).toContain("WIZ-10343");
  });

  it("dispatches an Android flow to runAndroidFlow and fires reporter events", async () => {
    const reporter = makeReporter();
    const deps = makeDeps({
      metaByFile: { "/a.ts": { target: "Android - Pixel" } },
      runResults: [passResult()],
      androidFlowDeps: makeFakeRunAndroidFlowDeps(),
      reporter,
    });
    await flowsRun(makeCtx(), ["/a.ts"], defaultFlags(), deps);
    const calls = callsOf(deps.runAndroidFlow);
    const arg = calls[0]?.[0] as {
      deps: unknown;
      flowPath: string;
      options: unknown;
    };
    expect(arg.deps).toBe(deps.runAndroidFlowDeps);
    expect(arg.flowPath).toBe("/a.ts");
    expect(arg.options).toMatchObject({ retries: 0, recordVideo: false });
    expect(reporter.onFlowPass).toHaveBeenCalledTimes(1);
  });

  it("runs web and Android flows in order and reports both", async () => {
    const reporter = makeReporter();
    const deps = makeDeps({
      metaByFile: {
        "/w.ts": { target: "Web - Chrome" },
        "/a.ts": { target: "Android - Pixel" },
      },
      runResults: [passResult(), passResult()],
      androidFlowDeps: makeFakeRunAndroidFlowDeps(),
      reporter,
    });
    await flowsRun(makeCtx(), ["/w.ts", "/a.ts"], defaultFlags(), deps);
    expect(callsOf(deps.runWebFlow).length).toBe(1);
    expect(callsOf(deps.runAndroidFlow).length).toBe(1);
    expect(reporter.onFlowPass).toHaveBeenCalledTimes(2);
    const completeCall = callsOf(reporter.onRunComplete!)[0]?.[0] as {
      summary: RunSummary;
    };
    expect(completeCall.summary.meta.browsers).toEqual(["chromium"]);
  });
});
