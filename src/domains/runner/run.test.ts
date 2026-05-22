import { afterEach, describe, expect, it, mock } from "bun:test";

import { runnerMessages } from "~/core/messages/index.js";
import {
  defaultFlags,
  makeCtx,
  makeDeps,
  makeFakeUI,
  passResult,
} from "./run.fixtures.js";
import { flowsRun } from "./run.js";

afterEach(() => {
  mock.restore();
});

describe("flowsRun pre-flight", () => {
  it("exits 2 with workers cap message when --workers > 1", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps();
    const flags = { ...defaultFlags(), workers: 4 };

    const result = await flowsRun(makeCtx(ui), [], flags, deps);

    expect(result).toEqual({
      error: runnerMessages.workersCapError,
      exitCode: 2,
    });
    expect(ui.error).toHaveBeenCalledWith(runnerMessages.workersCapError);
  });

  it("prints 'No flows matched.' and exits 0 when files is empty", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps();

    const result = await flowsRun(makeCtx(ui), [], defaultFlags(), deps);

    expect(result).toBeUndefined();
    expect(ui.info).toHaveBeenCalledWith(runnerMessages.noFlowsMatched);
    expect(deps.installBrowsers).not.toHaveBeenCalled();
  });

  it.each([
    ["iOS - iPad", "1 iOS flow skipped"],
    ["Basic", "1 Basic flow skipped"],
    ["Electron", "1 Electron flow skipped"],
  ] as const)(
    "warns and skips unsupported target %p without aborting",
    async (target, expectedWarning) => {
      const ui = makeFakeUI();
      const deps = makeDeps({ metaByFile: { "/a": { target } } });

      const result = await flowsRun(makeCtx(ui), ["/a"], defaultFlags(), deps);

      expect(result).toBeUndefined();
      expect(ui.warn).toHaveBeenCalledWith(expectedWarning);
      expect(ui.error).not.toHaveBeenCalled();
      expect(ui.info).not.toHaveBeenCalledWith(runnerMessages.noFlowsMatched);
      expect(deps.installBrowsers).not.toHaveBeenCalled();
    },
  );

  it("groups multiple same-type unsupported flows into one warning", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      metaByFile: {
        "/a": { target: "Basic" },
        "/b": { target: "Basic" },
      },
    });

    await flowsRun(makeCtx(ui), ["/a", "/b"], defaultFlags(), deps);

    expect(ui.warn).toHaveBeenCalledTimes(1);
    expect(ui.warn).toHaveBeenCalledWith("2 Basic flows skipped");
    expect(ui.info).not.toHaveBeenCalledWith(runnerMessages.noFlowsMatched);
  });

  it("groups multiple iOS flows into one warning without emitting noFlowsMatched", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      metaByFile: {
        "/a": { target: "iOS - iPad" },
        "/b": { target: "iOS - iPad" },
      },
    });

    const result = await flowsRun(
      makeCtx(ui),
      ["/a", "/b"],
      defaultFlags(),
      deps,
    );

    expect(result).toBeUndefined();
    expect(ui.warn).toHaveBeenCalledTimes(1);
    expect(ui.warn).toHaveBeenCalledWith("2 iOS flows skipped");
    expect(ui.info).not.toHaveBeenCalledWith(runnerMessages.noFlowsMatched);
  });

  it("warns per type and continues with supported flows in a mixed batch", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      metaByFile: {
        "/ios.flow.ts": { target: "iOS - iPad" },
        "/web.flow.ts": { target: "Web - Chrome" },
      },
      runResults: [passResult()],
    });

    const result = await flowsRun(
      makeCtx(ui),
      ["/ios.flow.ts", "/web.flow.ts"],
      defaultFlags(),
      deps,
    );

    expect(result).toBeUndefined();
    expect(ui.warn).toHaveBeenCalledWith("1 iOS flow skipped");
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
