// oxlint-disable eslint/max-lines -- the no-match exit-code cases pushed this past 250; splitting the flowsRun pre-flight suite would fragment coverage
import { afterEach, describe, expect, it, mock } from "bun:test";

import { runnerMessages } from "~/core/messages/index.js";
import { defaultFlags, makeCtx, makeDeps, passResult } from "./run.fixtures.js";
import { flowsRun } from "./run.js";

afterEach(() => {
  mock.restore();
});

describe("flowsRun pre-flight", () => {
  it("routes web flows to the pooled dispatch when --workers > 1", async () => {
    const ctx = makeCtx();
    const dispatch = mock(() =>
      Promise.resolve({ run: passResult(), durationMs: 1 }),
    );
    const createPooledDispatch = mock(() => dispatch);
    const deps = makeDeps({
      metaByFile: { "/web.flow.ts": { target: "Web - Chrome" } },
      createPooledDispatch,
    });
    const flags = { ...defaultFlags(), workers: 4 };

    const result = await flowsRun(ctx, ["/web.flow.ts"], flags, deps);

    expect(result).toBeUndefined();
    expect(createPooledDispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(deps.runWebFlow).not.toHaveBeenCalled();
  });

  it("exits 2 when --workers > 1 and android flows are present", async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      metaByFile: {
        "/a.flow.ts": { target: "Android - Pixel 9 (Android 15)" },
      },
    });
    const flags = { ...defaultFlags(), workers: 2 };

    const result = await flowsRun(ctx, ["/a.flow.ts"], flags, deps);

    expect(result).toEqual({
      error: runnerMessages.androidWorkersUnsupported,
      exitCode: 2,
    });
    expect(ctx.ui.error).toHaveBeenCalledWith(
      runnerMessages.androidWorkersUnsupported,
    );
  });

  it("exits 2 when no matched flow declares a target", async () => {
    const ctx = makeCtx();
    const deps = makeDeps({ metaByFile: { "/a.flow.ts": {} } });

    const result = await flowsRun(ctx, ["/a.flow.ts"], defaultFlags(), deps);

    expect(result).toEqual({
      error: runnerMessages.noTargetedFlows,
      exitCode: 2,
    });
    expect(deps.installBrowsers).not.toHaveBeenCalled();
  });

  it("exits 0 with an info notice when no flow declares a target under --allow-no-match", async () => {
    const ctx = makeCtx();
    const deps = makeDeps({ metaByFile: { "/a.flow.ts": {} } });
    const flags = { ...defaultFlags(), allowNoMatch: true };

    const result = await flowsRun(ctx, ["/a.flow.ts"], flags, deps);

    expect(result).toBeUndefined();
    expect(ctx.ui.info).toHaveBeenCalledWith(runnerMessages.noFlowsMatched);
    expect(deps.installBrowsers).not.toHaveBeenCalled();
  });

  it.each([
    ["iOS - iPad", runnerMessages.flowsSkipped("iOS", 1)],
    ["Basic", runnerMessages.flowsSkipped("Basic", 1)],
    ["Electron", runnerMessages.flowsSkipped("Electron", 1)],
  ] as const)(
    "warns about unsupported target %p and exits 2 when nothing else runs",
    async (target, expectedWarning) => {
      const ctx = makeCtx();
      const deps = makeDeps({ metaByFile: { "/a": { target } } });

      const result = await flowsRun(ctx, ["/a"], defaultFlags(), deps);

      expect(result).toEqual({
        error: runnerMessages.noRunnableFlows,
        exitCode: 2,
      });
      expect(ctx.ui.warn).toHaveBeenCalledWith(expectedWarning);
      expect(ctx.ui.info).not.toHaveBeenCalledWith(
        runnerMessages.noFlowsMatched,
      );
      expect(deps.installBrowsers).not.toHaveBeenCalled();
    },
  );

  it("exits 0 when every flow is skipped under --allow-no-match", async () => {
    const ctx = makeCtx();
    const deps = makeDeps({ metaByFile: { "/a": { target: "iOS - iPad" } } });
    const flags = { ...defaultFlags(), allowNoMatch: true };

    const result = await flowsRun(ctx, ["/a"], flags, deps);

    expect(result).toBeUndefined();
    expect(ctx.ui.warn).toHaveBeenCalledWith(
      runnerMessages.flowsSkipped("iOS", 1),
    );
    expect(ctx.ui.info).not.toHaveBeenCalledWith(runnerMessages.noFlowsMatched);
  });

  it("groups multiple same-type unsupported flows into one warning", async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      metaByFile: {
        "/a": { target: "Basic" },
        "/b": { target: "Basic" },
      },
    });

    await flowsRun(ctx, ["/a", "/b"], defaultFlags(), deps);

    expect(ctx.ui.warn).toHaveBeenCalledTimes(1);
    expect(ctx.ui.warn).toHaveBeenCalledWith(
      runnerMessages.flowsSkipped("Basic", 2),
    );
    expect(ctx.ui.info).not.toHaveBeenCalledWith(runnerMessages.noFlowsMatched);
  });

  it("groups multiple iOS flows into one warning and exits 2", async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      metaByFile: {
        "/a": { target: "iOS - iPad" },
        "/b": { target: "iOS - iPad" },
      },
    });

    const result = await flowsRun(ctx, ["/a", "/b"], defaultFlags(), deps);

    expect(result).toEqual({
      error: runnerMessages.noRunnableFlows,
      exitCode: 2,
    });
    expect(ctx.ui.warn).toHaveBeenCalledTimes(1);
    expect(ctx.ui.warn).toHaveBeenCalledWith(
      runnerMessages.flowsSkipped("iOS", 2),
    );
    expect(ctx.ui.info).not.toHaveBeenCalledWith(runnerMessages.noFlowsMatched);
  });

  it("exits 2 with an error for an unrecognized target string", async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      metaByFile: { "/a": { target: "Web - Chorme" } },
    });

    const result = await flowsRun(ctx, ["/a"], defaultFlags(), deps);

    expect(result).toEqual({
      error: "unrecognized flow target",
      exitCode: 2,
    });
    expect(ctx.ui.error).toHaveBeenCalledWith(
      runnerMessages.unrecognizedTarget("Web - Chorme"),
    );
    expect(ctx.ui.warn).not.toHaveBeenCalled();
  });

  it("exits 2 on the first unrecognized target in a mixed batch", async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      metaByFile: {
        "/ios.flow.ts": { target: "iOS - iPad" },
        "/bad.flow.ts": { target: "Web - Chorme" },
      },
    });

    const result = await flowsRun(
      ctx,
      ["/ios.flow.ts", "/bad.flow.ts"],
      defaultFlags(),
      deps,
    );

    expect(result).toEqual({
      error: "unrecognized flow target",
      exitCode: 2,
    });
    expect(ctx.ui.error).toHaveBeenCalledWith(
      runnerMessages.unrecognizedTarget("Web - Chorme"),
    );
  });

  it("warns per type and continues with supported flows in a mixed batch", async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      metaByFile: {
        "/ios.flow.ts": { target: "iOS - iPad" },
        "/web.flow.ts": { target: "Web - Chrome" },
      },
      runResults: [passResult()],
    });

    const result = await flowsRun(
      ctx,
      ["/ios.flow.ts", "/web.flow.ts"],
      defaultFlags(),
      deps,
    );

    expect(result).toBeUndefined();
    expect(ctx.ui.warn).toHaveBeenCalledWith(
      runnerMessages.flowsSkipped("iOS", 1),
    );
    expect(deps.installBrowsers).toHaveBeenCalled();
  });

  it("throws when installBrowsers fails", async () => {
    const deps = makeDeps({
      metaByFile: { "/a": { target: "Web - Chrome" } },
      installError: new Error("playwright install chromium failed: boom"),
    });

    expect(flowsRun(makeCtx(), ["/a"], defaultFlags(), deps)).rejects.toThrow(
      "playwright install chromium failed: boom",
    );
  });

  it("closes the intro block with an outro before streaming, then a trailing gap", async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      metaByFile: { "/a.flow.ts": { target: "Web - Chrome" } },
      runResults: [passResult()],
    });

    await flowsRun(ctx, ["/a.flow.ts"], defaultFlags(), deps);

    expect(ctx.ui.outro).toHaveBeenCalledWith("Running 1 flow");
    expect(ctx.ui.write).toHaveBeenCalledWith("\n");
    expect(ctx.ui.gap).toHaveBeenCalled();
  });

  it("does not call installBrowsers when all matched flows are Android targets", async () => {
    const deps = makeDeps({
      metaByFile: { "/a.flow.ts": { target: "Android - Pixel" } },
      // androidFlowDeps defaults to "not-wired" — dispatch fails, but installBrowsers must still not be called
    });

    await flowsRun(makeCtx(), ["/a.flow.ts"], defaultFlags(), deps);

    expect(deps.installBrowsers).not.toHaveBeenCalled();
  });
});
