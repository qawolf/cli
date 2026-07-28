import { afterEach, describe, expect, it, mock } from "bun:test";
import { createLaunch } from "./createLaunch.js";
import {
  makeBrowser,
  makeContext,
  makeDep,
} from "./web/createWebLaunchContext.fixtures.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { createSignalRegistry } from "~/shell/signals/createSignalRegistry.js";

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

  it("should close contexts before browsers on signal-driven shutdown", async () => {
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
    const signals = createSignalRegistry();

    const { launch } = createLaunch({
      browsers: { chromium: dep, firefox: dep, webkit: dep },
      contextSetup: {},
      launchBrowserOpts,
      signals,
      timeout: 30_000,
    });

    await launch();
    await signals.shutdown("SIGINT");

    expect(order).toEqual(["context:start", "context:end", "browser:start"]);
  });

  it("should wait for an in-progress teardown before cleanup resolves", async () => {
    const order: string[] = [];
    let releaseClose: (() => void) | undefined;
    const closeGate = new Promise<void>((resolve) => {
      releaseClose = resolve;
    });
    let closeStarted: (() => void) | undefined;
    const closeStartedGate = new Promise<void>((resolve) => {
      closeStarted = resolve;
    });
    const ctx = makeContext();
    ctx.close = mock(async () => {
      order.push("close:start");
      closeStarted?.();
      await closeGate;
      order.push("close:end");
    });
    const browser = makeBrowser(ctx);
    const dep = makeDep(browser, ctx);
    const signals = createSignalRegistry();

    const { launch, cleanup } = createLaunch({
      browsers: { chromium: dep, firefox: dep, webkit: dep },
      contextSetup: {},
      launchBrowserOpts,
      signals,
      timeout: 30_000,
    });

    await launch();
    // Signal-driven teardown starts and blocks inside context.close().
    const shutdown = signals.shutdown("SIGINT");
    await closeStartedGate;
    let cleanupResolved = false;
    const cleanupDone = cleanup().then(() => {
      cleanupResolved = true;
      order.push("cleanup:done");
    });
    // While close() is still blocked, cleanup must not have resolved —
    // otherwise callers unlink artifacts the teardown is still flushing.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cleanupResolved).toBe(false);

    releaseClose?.();
    await Promise.all([shutdown, cleanupDone]);
    expect(order).toEqual(["close:start", "close:end", "cleanup:done"]);
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
