import { afterEach, describe, expect, it, mock } from "bun:test";

import { installBrowsers } from "~/domains/install/browsers.js";
import {
  fakeCli,
  callsOf,
  makeDeps,
  makeFakeUI,
  makeCtx,
  ok,
  setup,
  spawnSequence,
} from "./browsers.fixtures.js";

afterEach(() => {
  mock.restore();
});

describe("installBrowsers", () => {
  it("spawns playwright cli with install <browser> on darwin (no --with-deps)", async () => {
    const { ui, deps, ctx } = setup("Web - Chrome");

    const result = await installBrowsers(ctx, undefined, deps);

    expect(result).toBeUndefined();
    expect(deps.spawn).toHaveBeenCalledTimes(1);
    expect(deps.spawn).toHaveBeenCalledWith(fakeCli, ["install", "chromium"]);
    expect(ui.withProgress).toHaveBeenCalledWith(
      expect.anything(),
      "Installed 1 browser.",
    );
  });

  it("spawns install for each unique browser sorted alphabetically", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/a", "/b", "/c"],
      metaByFile: {
        "/a": { target: "Web - Firefox" },
        "/b": { target: "Web - Safari" },
        "/c": { target: "Web - Chrome" },
      },
      spawn: spawnSequence(ok, ok, ok),
    });

    await installBrowsers(makeCtx(ui), undefined, deps);

    expect(callsOf(deps.spawn)).toEqual([
      [fakeCli, ["install", "chromium"]],
      [fakeCli, ["install", "firefox"]],
      [fakeCli, ["install", "webkit"]],
    ]);
    expect(ui.withProgress).toHaveBeenCalledWith(
      expect.anything(),
      "Installed 3 browsers.",
    );
  });

  it("invokes each browser only once when multiple flows share a target", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/a", "/b", "/c"],
      metaByFile: {
        "/a": { target: "Web - Chrome" },
        "/b": { target: "Web - Chrome" },
        "/c": { target: "Web - Chrome" },
      },
    });

    await installBrowsers(makeCtx(ui), undefined, deps);

    expect(deps.spawn).toHaveBeenCalledTimes(1);
    expect(ui.withProgress).toHaveBeenCalledWith(
      expect.anything(),
      "Installed 1 browser.",
    );
  });

  it("silently skips flows whose target is not a Playwright-driven web browser", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/a", "/b", "/c"],
      metaByFile: {
        "/a": { target: "Basic" },
        "/b": { target: "Electron" },
        "/c": { target: "Android - Pixel" },
      },
    });

    await installBrowsers(makeCtx(ui), undefined, deps);

    expect(deps.spawn).not.toHaveBeenCalled();
    expect(ui.info).toHaveBeenCalledWith(
      "No web flows requiring browser installation were found.",
    );
    expect(ui.success).not.toHaveBeenCalled();
  });

  it("reports no flows when expandPatterns returns empty", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({ files: [] });

    await installBrowsers(makeCtx(ui), undefined, deps);

    expect(deps.peekFlowMeta).not.toHaveBeenCalled();
    expect(deps.spawn).not.toHaveBeenCalled();
    expect(ui.info).toHaveBeenCalledWith(
      "No web flows requiring browser installation were found.",
    );
  });

  it("passes --with-deps before the browser name on Linux", async () => {
    const { deps, ctx } = setup("Web - Chrome", { platform: "linux" });

    await installBrowsers(ctx, undefined, deps);

    expect(deps.spawn).toHaveBeenCalledWith(fakeCli, [
      "install",
      "--with-deps",
      "chromium",
    ]);
  });

  it("throws and stops on first non-zero exit", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/a", "/b"],
      metaByFile: {
        "/a": { target: "Web - Chrome" },
        "/b": { target: "Web - Firefox" },
      },
      spawn: spawnSequence(ok, {
        exitCode: 1,
        stdout: "",
        stderr: "boom\nmore lines\n",
      }),
    });

    let caughtError: unknown;
    try {
      await installBrowsers(makeCtx(ui), undefined, deps);
    } catch (e) {
      caughtError = e;
    }

    expect(callsOf(deps.spawn).length).toBe(2);
    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe(
      "playwright install firefox failed: boom",
    );
    expect(ui.withProgress).toHaveBeenCalledTimes(1);
  });

  it("throws when spawn returns exitCode -1 (process failed to launch)", async () => {
    const { deps, ctx } = setup("Web - Chrome", {
      spawn: spawnSequence({ exitCode: -1, stdout: "", stderr: "" }),
    });

    let caughtError: unknown;
    try {
      await installBrowsers(ctx, undefined, deps);
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe(
      "playwright install chromium failed: process failed to launch",
    );
  });

  it("forwards the pattern argument to expandPatterns (string → single-element array; undefined → empty array)", async () => {
    const a = setup("Web - Chrome");
    await installBrowsers(a.ctx, "flows/login.flow.ts", a.deps);
    expect(a.deps.expandPatterns).toHaveBeenCalledWith(
      ["flows/login.flow.ts"],
      "/proj",
    );
    const b = setup("Web - Chrome");
    await installBrowsers(b.ctx, undefined, b.deps);
    expect(b.deps.expandPatterns).toHaveBeenCalledWith([], "/proj");
  });
});
