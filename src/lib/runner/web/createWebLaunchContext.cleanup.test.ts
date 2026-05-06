import { afterEach, describe, expect, it, mock } from "bun:test";
import { createWebLaunchContext } from "./createWebLaunchContext.js";
import type {
  BrowserDep,
  MinimalBrowser,
  MinimalBrowserContext,
  MinimalPage,
  MinimalVideo,
  WebLaunchOptions,
} from "./types.js";

afterEach(() => {
  mock.restore();
});

function makePage(video?: MinimalVideo): MinimalPage {
  return { video: () => video };
}

function makeContext(initialPages: MinimalPage[] = []): MinimalBrowserContext {
  return {
    setDefaultTimeout: () => {},
    close: async () => {},
    pages: () => initialPages,
    tracing: { start: async () => {}, stop: async () => {} },
    newPage: async () => makePage(),
  };
}

function makeBrowser(ctx: MinimalBrowserContext): MinimalBrowser {
  return {
    newContext: async () => ctx,
    close: async () => {},
  };
}

function makeDep(
  browser: MinimalBrowser,
  ctx: MinimalBrowserContext,
): BrowserDep {
  return {
    launch: async () => browser,
    launchPersistentContext: async () => ctx,
  };
}

const BASE_OPTIONS: WebLaunchOptions = {
  browser: "chromium",
  headed: false,
  slowMo: 0,
  timeout: 30_000,
  video: "off",
  trace: "off",
  outputDir: "/tmp/qawolf-test",
};

describe("createWebLaunchContext — cleanup and persistent", () => {
  it("should return empty videoPaths and tracePaths when video and trace are off", async () => {
    const ctx = makeContext();
    const browser = makeBrowser(ctx);
    const chromiumDep = makeDep(browser, ctx);
    const deps = {
      chromium: chromiumDep,
      firefox: chromiumDep,
      webkit: chromiumDep,
    };
    const wlc = createWebLaunchContext({ deps, options: BASE_OPTIONS });

    await wlc.launch();
    const result = await wlc.cleanup(true);

    expect(result).toEqual({ videoPaths: [], tracePaths: [] });
  });

  it("should use the firefox dep when browser option is firefox", async () => {
    const ctx = makeContext();
    const browser = makeBrowser(ctx);
    const firefoxLaunchMock = mock(async () => browser);
    const firefoxDep: BrowserDep = {
      launch: firefoxLaunchMock,
      launchPersistentContext: async () => ctx,
    };
    const chromiumDep = makeDep(browser, ctx);
    const deps = {
      chromium: chromiumDep,
      firefox: firefoxDep,
      webkit: chromiumDep,
    };
    const wlc = createWebLaunchContext({
      deps,
      options: { ...BASE_OPTIONS, browser: "firefox" as const },
    });

    await wlc.launch();

    expect(firefoxLaunchMock).toHaveBeenCalledTimes(1);
  });

  it("should use launchPersistentContext when browserContext is persistent", async () => {
    const ctx = makeContext();
    const browser = makeBrowser(ctx);
    const persistentMock = mock(async () => ctx);
    const chromiumDep: BrowserDep = {
      launch: async () => browser,
      launchPersistentContext: persistentMock,
    };
    const deps = {
      chromium: chromiumDep,
      firefox: chromiumDep,
      webkit: chromiumDep,
    };
    const wlc = createWebLaunchContext({ deps, options: BASE_OPTIONS });

    await wlc.launch({ browserContext: "persistent" });

    expect(persistentMock).toHaveBeenCalledTimes(1);
  });

  it("should use provided userDataDir for persistent context", async () => {
    const ctx = makeContext();
    const browser = makeBrowser(ctx);
    const persistentMock = mock(async () => ctx);
    const chromiumDep: BrowserDep = {
      launch: async () => browser,
      launchPersistentContext: persistentMock,
    };
    const deps = {
      chromium: chromiumDep,
      firefox: chromiumDep,
      webkit: chromiumDep,
    };
    const wlc = createWebLaunchContext({ deps, options: BASE_OPTIONS });

    await wlc.launch({
      browserContext: "persistent",
      userDataDir: "/my/profile",
    });

    expect(persistentMock).toHaveBeenCalledWith(
      "/my/profile",
      expect.any(Object),
    );
  });

  it("should generate a temp userDataDir when not provided for persistent context", async () => {
    const ctx = makeContext();
    const browser = makeBrowser(ctx);
    const persistentMock = mock(
      async (_userDataDir: string, _opts: object) => ctx,
    );
    const chromiumDep: BrowserDep = {
      launch: async () => browser,
      launchPersistentContext: persistentMock,
    };
    const deps = {
      chromium: chromiumDep,
      firefox: chromiumDep,
      webkit: chromiumDep,
    };
    const wlc = createWebLaunchContext({ deps, options: BASE_OPTIONS });

    await wlc.launch({ browserContext: "persistent" });

    const dir = persistentMock.mock.calls[0]?.[0];
    expect(typeof dir).toBe("string");
    expect((dir as string).length).toBeGreaterThan(0);
  });

  it("should not call browser.launch when browserContext is persistent", async () => {
    const ctx = makeContext();
    const browser = makeBrowser(ctx);
    const launchMock = mock(async () => browser);
    const chromiumDep: BrowserDep = {
      launch: launchMock,
      launchPersistentContext: async () => ctx,
    };
    const deps = {
      chromium: chromiumDep,
      firefox: chromiumDep,
      webkit: chromiumDep,
    };
    const wlc = createWebLaunchContext({ deps, options: BASE_OPTIONS });

    await wlc.launch({ browserContext: "persistent" });

    expect(launchMock).not.toHaveBeenCalled();
  });

  it("should close the context but not any browser when cleanup follows persistent launch", async () => {
    const ctx = makeContext();
    const closeContextMock = mock(async () => {});
    ctx.close = closeContextMock;
    const browser = makeBrowser(ctx);
    const closeBrowserMock = mock(async () => {});
    browser.close = closeBrowserMock;
    const chromiumDep: BrowserDep = {
      launch: async () => browser,
      launchPersistentContext: async () => ctx,
    };
    const deps = {
      chromium: chromiumDep,
      firefox: chromiumDep,
      webkit: chromiumDep,
    };
    const wlc = createWebLaunchContext({ deps, options: BASE_OPTIONS });

    await wlc.launch({ browserContext: "persistent" });
    await wlc.cleanup(true);

    expect(closeBrowserMock).not.toHaveBeenCalled();
    expect(closeContextMock).toHaveBeenCalledTimes(1);
  });
});
