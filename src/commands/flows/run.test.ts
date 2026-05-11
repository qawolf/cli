import { afterEach, describe, expect, it, mock } from "bun:test";

import {
  FAKE_CWD,
  defaultFlags,
  makeCtx,
  makeDeps,
  makeFakeUI,
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

    const result = await flowsRun(makeCtx(ui), undefined, flags, deps);

    expect(result).toEqual({
      error: "--workers > 1 is deferred to v0.2; current cap is 1.",
      exitCode: 2,
    });
    expect(ui.error).toHaveBeenCalledWith(
      "--workers > 1 is deferred to v0.2; current cap is 1.",
    );
    expect(deps.expandPatterns).not.toHaveBeenCalled();
  });

  it("forwards a string pattern as a single-element array to expandPatterns", async () => {
    const deps = makeDeps({ files: [] });

    await flowsRun(makeCtx(), "src/auth/*.flow.ts", defaultFlags(), deps);

    expect(deps.expandPatterns).toHaveBeenCalledWith(
      ["src/auth/*.flow.ts"],
      FAKE_CWD,
    );
  });

  it("forwards undefined pattern as empty array to expandPatterns", async () => {
    const deps = makeDeps({ files: [] });

    await flowsRun(makeCtx(), undefined, defaultFlags(), deps);

    expect(deps.expandPatterns).toHaveBeenCalledWith([], FAKE_CWD);
  });

  it("prints 'No flows matched.' and exits 0 when expandPatterns returns empty", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({ files: [] });

    const result = await flowsRun(makeCtx(ui), undefined, defaultFlags(), deps);

    expect(result).toBeUndefined();
    expect(ui.info).toHaveBeenCalledWith("No flows matched.");
    expect(deps.installBrowsers).not.toHaveBeenCalled();
  });

  it.each([
    [
      "iOS - iPad",
      "iOS - iPad targets aren't supported in v0.1. Run them on app.qawolf.com or wait for v0.2.",
    ],
    [
      "Basic",
      "Basic targets aren't supported in v0.1. Run them on app.qawolf.com or wait for v0.2.",
    ],
    [
      "Electron",
      "Electron targets aren't supported in v0.1. Run them on app.qawolf.com or wait for v0.2.",
    ],
    [
      "Android - Pixel",
      "Android targets aren't yet implemented in v0.1; tracked in WIZ-10446.",
    ],
  ] as const)(
    "rejects unsupported target %p with exit-2 message",
    async (target, expectedMessage) => {
      const ui = makeFakeUI();
      const deps = makeDeps({
        files: ["/a"],
        metaByFile: { "/a": { target } },
      });

      const result = await flowsRun(
        makeCtx(ui),
        undefined,
        defaultFlags(),
        deps,
      );

      expect(result).toEqual({ error: expectedMessage, exitCode: 2 });
      expect(ui.error).toHaveBeenCalledWith(expectedMessage);
      expect(deps.installBrowsers).not.toHaveBeenCalled();
    },
  );

  it("throws when installBrowsers fails", async () => {
    const deps = makeDeps({
      files: ["/a"],
      metaByFile: { "/a": { target: "Web - Chrome" } },
      installError: new Error("playwright install chromium failed: boom"),
    });

    expect(
      flowsRun(makeCtx(), undefined, defaultFlags(), deps),
    ).rejects.toThrow("playwright install chromium failed: boom");
  });

  it("prints pre-flight summary when web flows match and install succeeds", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/a.flow.ts", "/b.flow.ts"],
      metaByFile: {
        "/a.flow.ts": { target: "Web - Chrome" },
        "/b.flow.ts": { target: "Web - Firefox" },
      },
    });

    const result = await flowsRun(makeCtx(ui), undefined, defaultFlags(), deps);

    expect(result).toBeUndefined();
    expect(deps.installBrowsers).toHaveBeenCalledWith(expect.anything(), [
      "chromium",
      "firefox",
    ]);
    expect(ui.info).toHaveBeenCalledWith(
      "Pre-flight complete: 2 web flow(s) detected. (Dispatch lands in a follow-up PR.)",
    );
  });
});
