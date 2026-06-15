import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  makeBrowser,
  makeContext,
  makeDep,
  makePage,
  makeUniformDeps,
} from "./web/createWebLaunchContext.fixtures.js";
import { runWebFlow } from "./runWebFlow.js";
import { _resetInitCache } from "./initFlowRuntime.js";
import {
  baseOptions,
  fixturePath,
  makeWebDeps,
} from "./runWebFlow.fixtures.js";

afterEach(() => {
  // The expect-timeout readback test configures a process-global on
  // @qawolf/flows; clear the init cache so it does not leak into later tests.
  _resetInitCache();
  mock.restore();
});

/** Reads back the expect timeout configured on @qawolf/flows. */
async function readConfiguredExpectTimeout(): Promise<number> {
  const idxUrl = import.meta.resolve("@qawolf/flows");
  const attrsUrl = new URL("./web/expect/attributes.js", idxUrl).href;
  const { getWebExpectAttributes } = (await import(attrsUrl)) as {
    getWebExpectAttributes: () => { defaultExpectTimeoutMs: number };
  };
  return getWebExpectAttributes().defaultExpectTimeoutMs;
}

describe("runWebFlow", () => {
  it("should configure the @qawolf/flows expect timeout from options.timeout", async () => {
    // initFlowRuntime memoizes per flow directory and configures a
    // process-global on @qawolf/flows. Other runner tests share this
    // directory, so clear the cache to force a fresh configure here.
    _resetInitCache();

    await runWebFlow({
      deps: makeWebDeps(),
      options: { ...baseOptions, timeout: 7_777 },
      flowPath: fixturePath("pass"),
    });

    expect(await readConfiguredExpectTimeout()).toBe(7_777);
  });

  it("should return passed: true when the flow succeeds", async () => {
    const result = await runWebFlow({
      deps: makeWebDeps(),
      options: baseOptions,
      flowPath: fixturePath("pass"),
    });

    expect(result.passed).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it("should return passed: false when the flow throws", async () => {
    const result = await runWebFlow({
      deps: makeWebDeps(),
      options: baseOptions,
      flowPath: fixturePath("fail"),
    });

    expect(result.passed).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it("should call launch on the chromium dep for Web - Chrome target", async () => {
    const ctx = makeContext([makePage()]);
    const browser = makeBrowser(ctx);
    const launchMock = mock(async () => browser);
    const dep = {
      launch: launchMock,
      launchPersistentContext: async () => ctx,
    };
    const deps = makeWebDeps(makeUniformDeps(dep));

    await runWebFlow({
      deps,
      options: baseOptions,
      flowPath: fixturePath("launch"),
    });

    expect(launchMock).toHaveBeenCalledTimes(1);
    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({ headless: true, slowMo: 0 }),
    );
  });

  it("should close all open contexts and browsers on cleanup", async () => {
    const ctx = makeContext([makePage()]);
    const closeMock = mock(async () => {});
    ctx.close = closeMock;
    const browser = makeBrowser(ctx);
    const browserCloseMock = mock(async () => {});
    browser.close = browserCloseMock;
    const deps = makeWebDeps(makeUniformDeps(makeDep(browser, ctx)));

    await runWebFlow({
      deps,
      options: baseOptions,
      flowPath: fixturePath("launch"),
    });

    expect(closeMock).toHaveBeenCalled();
    expect(browserCloseMock).toHaveBeenCalled();
  });

  it("should not retry when failWithoutRetry is called", async () => {
    const result = await runWebFlow({
      deps: makeWebDeps(),
      options: { ...baseOptions, retries: 2 },
      flowPath: fixturePath("failNoRetry"),
    });

    expect(result.passed).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it("should fail the flow when an unsupported dependency is called", async () => {
    const result = await runWebFlow({
      deps: makeWebDeps(),
      options: baseOptions,
      flowPath: fixturePath("getInbox"),
    });

    expect(result.passed).toBe(false);
    const cause = (result.error as Error & { cause?: unknown })?.cause;
    expect(cause).toBeInstanceOf(Error);
    expect((cause as Error).message).toContain("not supported");
  });

  it("should not retry when the failWithoutRetry dep is called", async () => {
    const result = await runWebFlow({
      deps: makeWebDeps(),
      options: { ...baseOptions, retries: 2 },
      flowPath: fixturePath("failViaStub"),
    });

    expect(result.passed).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it("should throw when the flow file has no default export", async () => {
    let caughtError: unknown;
    try {
      await runWebFlow({
        deps: makeWebDeps(),
        options: baseOptions,
        flowPath: fixturePath("noDefault"),
      });
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain("No default export found");
  });

  it("should close all open contexts and browsers when the flow throws", async () => {
    const ctx = makeContext([makePage()]);
    const closeMock = mock(async () => {});
    ctx.close = closeMock;
    const browser = makeBrowser(ctx);
    const browserCloseMock = mock(async () => {});
    browser.close = browserCloseMock;
    const deps = makeWebDeps(makeUniformDeps(makeDep(browser, ctx)));

    await runWebFlow({
      deps,
      options: baseOptions,
      flowPath: fixturePath("failAfterLaunch"),
    });

    expect(closeMock).toHaveBeenCalled();
    expect(browserCloseMock).toHaveBeenCalled();
  });
});
