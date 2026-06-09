import { afterEach, describe, expect, it, mock } from "bun:test";

import { runnerMessages } from "~/core/messages/index.js";
import type { RunSummary } from "~/shell/reporter/types.js";

import {
  callsOf,
  defaultFlags,
  makeCtx,
  makeDeps,
  makeFakeRunAndroidFlowDeps,
  makeReporter,
  passResult,
  failResult,
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
    expect(result).toEqual({ error: runnerMessages.flowsFailed(1) });
    expect(reporter.onFlowFail).toHaveBeenCalledTimes(1);
    const failCall = callsOf(reporter.onFlowFail!)[0]?.[0] as { err: Error };
    expect((failCall.err.cause as Error).message).toContain(
      "Android flows are not yet supported in this mode.",
    );
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
    expect(arg.deps).toMatchObject(deps.runAndroidFlowDeps as object);
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

describe("flowsRun Android lifecycle", () => {
  it("should call bootAndroid with deduplicated avd names before dispatching flows", async () => {
    const bootAndroid = mock(() => Promise.resolve());
    const shutdownAndroid = mock(() => {});
    const deps = makeDeps({
      metaByFile: {
        "/a.ts": { target: "Android - Pixel 9 (Android 15)" },
        "/b.ts": { target: "Android - Pixel 9 (Android 15)" },
      },
      runResults: [passResult(), passResult()],
      androidFlowDeps: makeFakeRunAndroidFlowDeps(),
      bootAndroid,
      shutdownAndroid,
    });
    await flowsRun(makeCtx(), ["/a.ts", "/b.ts"], defaultFlags(), deps);
    expect(bootAndroid).toHaveBeenCalledTimes(1);
    const [avdNames] = callsOf(bootAndroid)[0] as [string[]];
    expect(avdNames).toHaveLength(1);
    expect(avdNames[0]).toMatch(/^qawolf_/);
    expect(shutdownAndroid).toHaveBeenCalledTimes(1);
  });

  it("should call shutdownAndroid even when runFlows throws", async () => {
    const shutdownAndroid = mock(() => {});
    const deps = makeDeps({
      metaByFile: { "/a.ts": { target: "Android - Pixel 9 (Android 15)" } },
      runResults: [failResult(new Error("crash"))],
      androidFlowDeps: makeFakeRunAndroidFlowDeps(),
      bootAndroid: () => Promise.resolve(),
      shutdownAndroid,
    });
    await flowsRun(makeCtx(), ["/a.ts"], defaultFlags(), deps);
    expect(shutdownAndroid).toHaveBeenCalledTimes(1);
  });

  it("should surface boot error via ui.error and call shutdownAndroid when bootAndroid throws", async () => {
    const shutdownAndroid = mock(() => {});
    const ctx = makeCtx();
    const deps = makeDeps({
      metaByFile: { "/a.ts": { target: "Android - Pixel 9 (Android 15)" } },
      androidFlowDeps: makeFakeRunAndroidFlowDeps(),
      bootAndroid: () => Promise.reject(new Error("avd boot failed")),
      shutdownAndroid,
    });
    const result = await flowsRun(ctx, ["/a.ts"], defaultFlags(), deps);
    expect(ctx.ui.error).toHaveBeenCalledWith(
      expect.stringContaining("avd boot failed"),
    );
    expect((result as { error: string }).error).toContain("avd boot failed");
    expect(shutdownAndroid).toHaveBeenCalledTimes(1);
  });
});
