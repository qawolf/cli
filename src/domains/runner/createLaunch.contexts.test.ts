import { afterEach, describe, expect, it, mock } from "bun:test";
import { createLaunch } from "./createLaunch.js";
import type { ContextSetupOptions } from "./web/types.js";
import {
  makeBrowser,
  makeContext,
  makeDep,
} from "./web/createWebLaunchContext.fixtures.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

afterEach(() => {
  mock.restore();
});

const launchBrowserOpts = { headless: true, slowMo: 0 };

describe("createLaunch flow-created contexts", () => {
  const harContextSetup = {
    recordVideo: { dir: "/out/videos", size: { width: 1280, height: 720 } },
    recordHar: {
      path: "/out/har/flow.har",
      mode: "minimal" as const,
      content: "omit" as const,
    },
  };

  it("should apply recording options to contexts created via browser.newContext", async () => {
    const ctx = makeContext();
    const flowCtx = makeContext();
    const browser = makeBrowser(ctx);
    const captured: ContextSetupOptions[] = [];
    let calls = 0;
    browser.newContext = mock(async (opts: ContextSetupOptions) => {
      captured.push(opts);
      calls += 1;
      return calls === 1 ? ctx : flowCtx;
    });
    const dep = makeDep(browser, ctx);

    const { launch } = createLaunch({
      browsers: { chromium: dep, firefox: dep, webkit: dep },
      contextSetup: harContextSetup,
      launchBrowserOpts,
      signals: makeNoopSignals(),
      timeout: 30_000,
    });

    const result = await launch();
    if (!("browser" in result)) throw new Error("expected browser in result");
    await result.browser.newContext({
      viewport: { width: 400, height: 300 },
    });

    const flowOpts = captured[1];
    // Caller options win on conflicts; recording options are added.
    expect(flowOpts?.viewport).toEqual({ width: 400, height: 300 });
    expect(flowOpts?.recordVideo?.dir).toBe("/out/videos");
    expect(flowOpts?.recordHar?.path).toBeDefined();
  });

  it("should give each context a distinct recordHar path", async () => {
    const ctx = makeContext();
    const flowCtx = makeContext();
    const browser = makeBrowser(ctx);
    const harPaths: (string | undefined)[] = [];
    let calls = 0;
    browser.newContext = mock(async (opts: ContextSetupOptions) => {
      harPaths.push(opts.recordHar?.path);
      calls += 1;
      return calls === 1 ? ctx : flowCtx;
    });
    const dep = makeDep(browser, ctx);

    const { launch } = createLaunch({
      browsers: { chromium: dep, firefox: dep, webkit: dep },
      contextSetup: harContextSetup,
      launchBrowserOpts,
      signals: makeNoopSignals(),
      timeout: 30_000,
    });

    const result = await launch();
    if (!("browser" in result)) throw new Error("expected browser in result");
    await result.browser.newContext({});

    expect(harPaths[0]).toBe("/out/har/flow.har");
    expect(harPaths[1]).toBe("/out/har/flow-2.har");
  });

  it("should track flow-created contexts for tracing and teardown", async () => {
    const ctx = makeContext();
    const flowCtx = makeContext();
    const flowStart = mock(async () => {});
    const flowStop = mock(async (_opts?: { path?: string }) => {});
    flowCtx.tracing = { start: flowStart, stop: flowStop };
    const flowClose = mock(async () => {});
    flowCtx.close = flowClose;
    const browser = makeBrowser(ctx);
    let calls = 0;
    browser.newContext = mock(async () => {
      calls += 1;
      return calls === 1 ? ctx : flowCtx;
    });
    const dep = makeDep(browser, ctx);

    const { launch, cleanup } = createLaunch({
      browsers: { chromium: dep, firefox: dep, webkit: dep },
      contextSetup: {},
      launchBrowserOpts,
      signals: makeNoopSignals(),
      timeout: 30_000,
      traceMode: "on",
      tracePath: "/out/trace/flow.zip",
    });

    const result = await launch();
    if (!("browser" in result)) throw new Error("expected browser in result");
    await result.browser.newContext({});
    await cleanup();

    expect(flowStart).toHaveBeenCalledTimes(1);
    expect(flowClose).toHaveBeenCalledTimes(1);
  });

  it("should stop each context's trace to a distinct path", async () => {
    const ctx = makeContext();
    const flowCtx = makeContext();
    const stopPaths: (string | undefined)[] = [];
    ctx.tracing = {
      start: async () => {},
      stop: async (opts?: { path?: string }) => {
        stopPaths.push(opts?.path);
      },
    };
    flowCtx.tracing = {
      start: async () => {},
      stop: async (opts?: { path?: string }) => {
        stopPaths.push(opts?.path);
      },
    };
    const browser = makeBrowser(ctx);
    let calls = 0;
    browser.newContext = mock(async () => {
      calls += 1;
      return calls === 1 ? ctx : flowCtx;
    });
    const dep = makeDep(browser, ctx);

    const { launch, cleanup } = createLaunch({
      browsers: { chromium: dep, firefox: dep, webkit: dep },
      contextSetup: {},
      launchBrowserOpts,
      signals: makeNoopSignals(),
      timeout: 30_000,
      traceMode: "on",
      tracePath: "/out/trace/flow.zip",
    });

    const result = await launch();
    if (!("browser" in result)) throw new Error("expected browser in result");
    await result.browser.newContext({});
    await cleanup();

    // Contexts stop in creation order: launch()'s context first.
    expect(stopPaths).toEqual(["/out/trace/flow.zip", "/out/trace/flow-2.zip"]);
  });

  it("should expose the har and trace paths assigned to every context", async () => {
    const ctx = makeContext();
    const flowCtx = makeContext();
    const browser = makeBrowser(ctx);
    let calls = 0;
    browser.newContext = mock(async () => {
      calls += 1;
      return calls === 1 ? ctx : flowCtx;
    });
    const dep = makeDep(browser, ctx);

    const { launch, artifactPaths } = createLaunch({
      browsers: { chromium: dep, firefox: dep, webkit: dep },
      contextSetup: harContextSetup,
      launchBrowserOpts,
      signals: makeNoopSignals(),
      timeout: 30_000,
      traceMode: "on",
      tracePath: "/out/trace/flow.zip",
    });

    const result = await launch();
    if (!("browser" in result)) throw new Error("expected browser in result");
    await result.browser.newContext({});

    expect(artifactPaths()).toEqual({
      harPaths: ["/out/har/flow.har", "/out/har/flow-2.har"],
      tracePaths: ["/out/trace/flow.zip", "/out/trace/flow-2.zip"],
    });
  });
});
