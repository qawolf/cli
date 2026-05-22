import { afterEach, describe, expect, it, mock } from "bun:test";

import { runnerMessages } from "~/core/messages/index.js";
import { defaultFlags, makeCtx, makeDeps, passResult } from "./run.fixtures.js";
import { flowsRun } from "./run.js";

afterEach(() => {
  mock.restore();
});

describe("flowsRun pre-flight", () => {
  it("exits 2 with workers cap message when --workers > 1", async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    const flags = { ...defaultFlags(), workers: 4 };

    const result = await flowsRun(ctx, [], flags, deps);

    expect(result).toEqual({
      error: runnerMessages.workersCapError,
      exitCode: 2,
    });
    expect(ctx.ui.error).toHaveBeenCalledWith(runnerMessages.workersCapError);
  });

  it("prints 'No flows matched.' and exits 0 when files is empty", async () => {
    const ctx = makeCtx();
    const deps = makeDeps();

    const result = await flowsRun(ctx, [], defaultFlags(), deps);

    expect(result).toBeUndefined();
    expect(ctx.ui.info).toHaveBeenCalledWith(runnerMessages.noFlowsMatched);
    expect(deps.installBrowsers).not.toHaveBeenCalled();
  });

  it.each([
    ["iOS - iPad", "1 iOS flow skipped"],
    ["Basic", "1 Basic flow skipped"],
    ["Electron", "1 Electron flow skipped"],
  ] as const)(
    "warns and skips unsupported target %p without aborting",
    async (target, expectedWarning) => {
      const ctx = makeCtx();
      const deps = makeDeps({ metaByFile: { "/a": { target } } });

      const result = await flowsRun(ctx, ["/a"], defaultFlags(), deps);

      expect(result).toBeUndefined();
      expect(ctx.ui.warn).toHaveBeenCalledWith(expectedWarning);
      expect(ctx.ui.error).not.toHaveBeenCalled();
      expect(ctx.ui.info).not.toHaveBeenCalledWith(
        runnerMessages.noFlowsMatched,
      );
      expect(deps.installBrowsers).not.toHaveBeenCalled();
    },
  );

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
    expect(ctx.ui.warn).toHaveBeenCalledWith("2 Basic flows skipped");
    expect(ctx.ui.info).not.toHaveBeenCalledWith(runnerMessages.noFlowsMatched);
  });

  it("groups multiple iOS flows into one warning without emitting noFlowsMatched", async () => {
    const ctx = makeCtx();
    const deps = makeDeps({
      metaByFile: {
        "/a": { target: "iOS - iPad" },
        "/b": { target: "iOS - iPad" },
      },
    });

    const result = await flowsRun(ctx, ["/a", "/b"], defaultFlags(), deps);

    expect(result).toBeUndefined();
    expect(ctx.ui.warn).toHaveBeenCalledTimes(1);
    expect(ctx.ui.warn).toHaveBeenCalledWith("2 iOS flows skipped");
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
      `Unrecognized flow target: "Web - Chorme"`,
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
      `Unrecognized flow target: "Web - Chorme"`,
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
    expect(ctx.ui.warn).toHaveBeenCalledWith("1 iOS flow skipped");
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

  it("does not call installBrowsers when all matched flows are Android targets", async () => {
    const deps = makeDeps({
      metaByFile: { "/a.flow.ts": { target: "Android - Pixel" } },
      // androidFlowDeps defaults to "not-wired" — dispatch fails, but installBrowsers must still not be called
    });

    await flowsRun(makeCtx(), ["/a.flow.ts"], defaultFlags(), deps);

    expect(deps.installBrowsers).not.toHaveBeenCalled();
  });
});
