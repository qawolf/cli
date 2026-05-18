import { afterEach, describe, expect, it, mock } from "bun:test";
import { createWebLaunchContext } from "./createWebLaunchContext.js";
import {
  makeBrowser,
  makeContext,
  makeDep,
  makePage,
  makeUniformDeps,
} from "./createWebLaunchContext.fixtures.js";
import type {
  BrowserDep,
  ContextSetupOptions,
  MinimalBrowser,
  WebLaunchOptions,
} from "./types.js";

afterEach(() => {
  mock.restore();
});

const baseOptions: WebLaunchOptions = {
  browser: "chromium",
  headed: false,
  slowMo: 0,
  timeout: 30_000,
  video: "off",
  trace: "off",
  outputDir: "/tmp/qawolf-test",
};

describe("createWebLaunchContext", () => {
  it("should call launch on the selected browser dep", async () => {
    const ctx = makeContext();
    const browser = makeBrowser(ctx);
    const launchMock = mock(async () => browser);
    const chromiumDep: BrowserDep = {
      launch: launchMock,
      launchPersistentContext: async () => ctx,
    };
    const wlc = createWebLaunchContext({
      deps: makeUniformDeps(chromiumDep),
      options: baseOptions,
    });

    await wlc.launch();

    expect(launchMock).toHaveBeenCalledTimes(1);
  });

  it("should pass headless true and slowMo to browser launch when headed is false", async () => {
    const ctx = makeContext();
    const browser = makeBrowser(ctx);
    const launchMock = mock(async () => browser);
    const chromiumDep: BrowserDep = {
      launch: launchMock,
      launchPersistentContext: async () => ctx,
    };
    const wlc = createWebLaunchContext({
      deps: makeUniformDeps(chromiumDep),
      options: { ...baseOptions, headed: false },
    });

    await wlc.launch();

    expect(launchMock).toHaveBeenCalledWith({ headless: true, slowMo: 0 });
  });

  it("should pass headless false and slowMo to browser launch when headed is true", async () => {
    const ctx = makeContext();
    const browser = makeBrowser(ctx);
    const launchMock = mock(async () => browser);
    const chromiumDep: BrowserDep = {
      launch: launchMock,
      launchPersistentContext: async () => ctx,
    };
    const wlc = createWebLaunchContext({
      deps: makeUniformDeps(chromiumDep),
      options: { ...baseOptions, headed: true },
    });

    await wlc.launch();

    expect(launchMock).toHaveBeenCalledWith({ headless: false, slowMo: 0 });
  });

  it("should include executablePath in launch options when provided", async () => {
    const ctx = makeContext();
    const browser = makeBrowser(ctx);
    const launchMock = mock(async () => browser);
    const chromiumDep: BrowserDep = {
      launch: launchMock,
      launchPersistentContext: async () => ctx,
    };
    const wlc = createWebLaunchContext({
      deps: makeUniformDeps(chromiumDep),
      options: { ...baseOptions, executablePath: "/usr/bin/chrome" },
    });

    await wlc.launch();

    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({ executablePath: "/usr/bin/chrome" }),
    );
  });

  it("should call newContext with default viewport when video is off", async () => {
    const ctx = makeContext();
    const newContextMock = mock(async (_opts: ContextSetupOptions) => ctx);
    const browser: MinimalBrowser = {
      newContext: newContextMock,
      close: async () => {},
    };
    const launchMock = mock(async () => browser);
    const chromiumDep: BrowserDep = {
      launch: launchMock,
      launchPersistentContext: async () => ctx,
    };
    const wlc = createWebLaunchContext({
      deps: makeUniformDeps(chromiumDep),
      options: { ...baseOptions, video: "off" },
    });

    await wlc.launch();

    expect(newContextMock).toHaveBeenCalledWith({
      viewport: { width: 1280, height: 720 },
      screen: { width: 1280, height: 720 },
    });
  });

  it("should pass recordVideo dir and size to newContext when video is on", async () => {
    const ctx = makeContext();
    const newContextMock = mock(async (_opts: ContextSetupOptions) => ctx);
    const browser: MinimalBrowser = {
      newContext: newContextMock,
      close: async () => {},
    };
    const launchMock = mock(async () => browser);
    const chromiumDep: BrowserDep = {
      launch: launchMock,
      launchPersistentContext: async () => ctx,
    };
    const wlc = createWebLaunchContext({
      deps: makeUniformDeps(chromiumDep),
      options: { ...baseOptions, video: "on" },
    });

    await wlc.launch();

    const opts = newContextMock.mock.calls[0]?.[0];
    expect(opts?.recordVideo?.dir).toContain("videos");
    expect(opts?.recordVideo?.size).toEqual({ width: 1280, height: 720 });
  });

  it("should not include recordVideo when video is off", async () => {
    const ctx = makeContext();
    const newContextMock = mock(async (_opts: ContextSetupOptions) => ctx);
    const browser: MinimalBrowser = {
      newContext: newContextMock,
      close: async () => {},
    };
    const launchMock = mock(async () => browser);
    const chromiumDep: BrowserDep = {
      launch: launchMock,
      launchPersistentContext: async () => ctx,
    };
    const wlc = createWebLaunchContext({
      deps: makeUniformDeps(chromiumDep),
      options: { ...baseOptions, video: "off" },
    });

    await wlc.launch();

    const arg = newContextMock.mock.calls[0]?.[0] ?? {};
    expect(arg).not.toHaveProperty("recordVideo");
  });

  it("should set default timeout on context after anonymous launch", async () => {
    const ctx = makeContext();
    const setDefaultTimeoutMock = mock((_ms: number) => {});
    ctx.setDefaultTimeout = setDefaultTimeoutMock;
    const browser = makeBrowser(ctx);
    const chromiumDep: BrowserDep = {
      launch: async () => browser,
      launchPersistentContext: async () => ctx,
    };
    const wlc = createWebLaunchContext({
      deps: makeUniformDeps(chromiumDep),
      options: baseOptions,
    });

    await wlc.launch();

    expect(setDefaultTimeoutMock).toHaveBeenCalledWith(30_000);
  });

  it("should return pages from all open contexts", async () => {
    const page = makePage();
    const ctx = makeContext([page]);
    const browser = makeBrowser(ctx);
    const wlc = createWebLaunchContext({
      deps: makeUniformDeps(makeDep(browser, ctx)),
      options: baseOptions,
    });

    await wlc.launch();
    const result = wlc.pages();

    expect(result).toContain(page);
  });
});
