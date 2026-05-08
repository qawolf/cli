import { afterEach, describe, expect, it, mock } from "bun:test";

import { installBrowsers } from "./browsers.js";
import {
  FAKE_CLI,
  FAKE_NODE,
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
    const { ui, deps, ctx } = setup("chromium");

    const result = await installBrowsers(ctx, undefined, deps);

    expect(result).toBeUndefined();
    expect(deps.spawn).toHaveBeenCalledTimes(1);
    expect(deps.spawn).toHaveBeenCalledWith(FAKE_NODE, [
      FAKE_CLI,
      "install",
      "chromium",
    ]);
    expect(ui.info).toHaveBeenCalledWith("Installing chromium...");
    expect(ui.success).toHaveBeenCalledWith("Installed 1 browser.");
  });

  it("spawns install for each unique browser sorted alphabetically", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/a", "/b", "/c"],
      metaByFile: {
        "/a": { target: "firefox" },
        "/b": { target: "webkit" },
        "/c": { target: "chromium" },
      },
      spawn: spawnSequence(ok, ok, ok),
    });

    await installBrowsers(makeCtx(ui), undefined, deps);

    expect(callsOf(deps.spawn)).toEqual([
      [FAKE_NODE, [FAKE_CLI, "install", "chromium"]],
      [FAKE_NODE, [FAKE_CLI, "install", "firefox"]],
      [FAKE_NODE, [FAKE_CLI, "install", "webkit"]],
    ]);
    expect(ui.success).toHaveBeenCalledWith("Installed 3 browsers.");
  });

  it("invokes each browser only once when multiple flows share a target", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/a", "/b", "/c"],
      metaByFile: {
        "/a": { target: "chromium" },
        "/b": { target: "chromium" },
        "/c": { target: "chromium" },
      },
    });

    await installBrowsers(makeCtx(ui), undefined, deps);

    expect(deps.spawn).toHaveBeenCalledTimes(1);
    expect(ui.success).toHaveBeenCalledWith("Installed 1 browser.");
  });

  it("silently skips flows whose target is not a known browser", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/a", "/b"],
      metaByFile: {
        "/a": { target: "Web - Chrome" },
        "/b": { target: "android" },
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
    const { deps, ctx } = setup("chromium", { platform: "linux" });

    await installBrowsers(ctx, undefined, deps);

    expect(deps.spawn).toHaveBeenCalledWith(FAKE_NODE, [
      FAKE_CLI,
      "install",
      "--with-deps",
      "chromium",
    ]);
  });

  it("returns error and stops on first non-zero exit", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/a", "/b"],
      metaByFile: {
        "/a": { target: "chromium" },
        "/b": { target: "firefox" },
      },
      spawn: spawnSequence(ok, {
        exitCode: 1,
        stdout: "",
        stderr: "boom\nmore lines\n",
      }),
    });

    const result = await installBrowsers(makeCtx(ui), undefined, deps);

    expect(callsOf(deps.spawn).length).toBe(2);
    expect(result).toEqual({
      error: "playwright install firefox failed: boom",
    });
    expect(ui.success).not.toHaveBeenCalled();
  });

  it("returns error when spawn returns exitCode -1 (process failed to launch)", async () => {
    const { deps, ctx, ui } = setup("chromium", {
      spawn: spawnSequence({ exitCode: -1, stdout: "", stderr: "" }),
    });

    const result = await installBrowsers(ctx, undefined, deps);

    expect(result).toEqual({
      error: "playwright install chromium failed: process failed to launch",
    });
    expect(ui.success).not.toHaveBeenCalled();
  });

  it("forwards the pattern argument to expandPatterns (string → single-element array; undefined → empty array)", async () => {
    const a = setup("chromium");
    await installBrowsers(a.ctx, "flows/login.flow.ts", a.deps);
    expect(a.deps.expandPatterns).toHaveBeenCalledWith(
      ["flows/login.flow.ts"],
      "/proj",
    );
    const b = setup("chromium");
    await installBrowsers(b.ctx, undefined, b.deps);
    expect(b.deps.expandPatterns).toHaveBeenCalledWith([], "/proj");
  });
});
