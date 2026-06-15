import { afterEach, describe, expect, it, mock } from "bun:test";
import { createLaunch } from "./runWebFlowUtils.js";
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

describe("createLaunch cleanup", () => {
  it("should close browsers only after contexts have fully closed", async () => {
    const order: string[] = [];
    const ctx = makeContext();
    ctx.close = mock(async () => {
      order.push("context:start");
      await Promise.resolve();
      order.push("context:end");
    });
    const browser = makeBrowser(ctx);
    browser.close = mock(async () => {
      order.push("browser:start");
    });
    const dep = makeDep(browser, ctx);

    const { launch, cleanup } = createLaunch({
      browsers: { chromium: dep, firefox: dep, webkit: dep },
      contextSetup: {},
      launchBrowserOpts,
      signals: makeNoopSignals(),
      timeout: 30_000,
    });

    await launch();
    await cleanup();

    expect(order).toEqual(["context:start", "context:end", "browser:start"]);
  });
});

describe("createLaunch tracing", () => {
  it("should start tracing after creating the context when trace is on", async () => {
    const ctx = makeContext();
    const startMock = mock(async () => {});
    ctx.tracing = { start: startMock, stop: async () => {} };
    const dep = makeDep(makeBrowser(ctx), ctx);

    const { launch } = createLaunch({
      browsers: { chromium: dep, firefox: dep, webkit: dep },
      contextSetup: {},
      launchBrowserOpts,
      signals: makeNoopSignals(),
      timeout: 30_000,
      traceMode: "on",
      tracePath: "/out/trace/flow.zip",
    });

    await launch();

    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it("should not start tracing when trace is off", async () => {
    const ctx = makeContext();
    const startMock = mock(async () => {});
    ctx.tracing = { start: startMock, stop: async () => {} };
    const dep = makeDep(makeBrowser(ctx), ctx);

    const { launch } = createLaunch({
      browsers: { chromium: dep, firefox: dep, webkit: dep },
      contextSetup: {},
      launchBrowserOpts,
      signals: makeNoopSignals(),
      timeout: 30_000,
      traceMode: "off",
      tracePath: undefined,
    });

    await launch();

    expect(startMock).not.toHaveBeenCalled();
  });

  it("should stop tracing to the trace path before closing the context", async () => {
    const order: string[] = [];
    const ctx = makeContext();
    const stopMock = mock(async (_opts: { path?: string }) => {
      order.push("trace:stop");
    });
    ctx.tracing = { start: async () => {}, stop: stopMock };
    ctx.close = mock(async () => {
      order.push("context:close");
    });
    const dep = makeDep(makeBrowser(ctx), ctx);

    const { launch, cleanup } = createLaunch({
      browsers: { chromium: dep, firefox: dep, webkit: dep },
      contextSetup: {},
      launchBrowserOpts,
      signals: makeNoopSignals(),
      timeout: 30_000,
      traceMode: "on",
      tracePath: "/out/trace/flow.zip",
    });

    await launch();
    await cleanup();

    expect(stopMock).toHaveBeenCalledWith({ path: "/out/trace/flow.zip" });
    expect(order).toEqual(["trace:stop", "context:close"]);
  });
});
