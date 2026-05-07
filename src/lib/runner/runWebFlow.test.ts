import { afterEach, describe, expect, it, mock } from "bun:test";
import type { RunnerDeps } from "./types.js";
import type { WebLaunchDeps } from "./web/types.js";
import {
  makeBrowser,
  makeContext,
  makeDep,
  makePage,
  makeUniformDeps,
} from "./web/createWebLaunchContext.fixtures.js";
import { runWebFlow } from "./runWebFlow.js";
import type { RunWebFlowDeps, RunWebFlowOptions } from "./runWebFlow.js";

afterEach(() => {
  mock.restore();
});

function makeRunnerDeps(): RunnerDeps {
  return {
    fs: { mkdir: async () => {}, writeFile: async () => {} },
    spawn: () => ({ exitCode: Promise.resolve(0), kill: () => {} }),
    signals: { on: () => () => {} },
    createStorage: <T>() => ({
      run: async (_store: T, callback: () => Promise<void>) => callback(),
      getStore: () => undefined,
    }),
  };
}

function makeWebDeps(webLaunchDeps?: WebLaunchDeps): RunWebFlowDeps {
  const ctx = makeContext([makePage()]);
  const browser = makeBrowser(ctx);
  const dep = makeDep(browser, ctx);
  return {
    ...makeRunnerDeps(),
    ...(webLaunchDeps ?? makeUniformDeps(dep)),
  };
}

const BASE_OPTIONS: RunWebFlowOptions = {
  retries: 0,
  outputDir: "/tmp/qawolf-test",
  headed: false,
  slowMo: 0,
  video: "off",
  timeout: 30_000,
};

function fixturePath(name: string): string {
  return new URL(`./runWebFlow.${name}.fixture.ts`, import.meta.url).pathname;
}

describe("runWebFlow", () => {
  it("should return passed: true when the flow succeeds", async () => {
    const result = await runWebFlow({
      deps: makeWebDeps(),
      options: BASE_OPTIONS,
      flowPath: fixturePath("pass"),
    });

    expect(result.passed).toBe(true);
    expect(result.attempts).toBe(1);
  });

  it("should return passed: false when the flow throws", async () => {
    const result = await runWebFlow({
      deps: makeWebDeps(),
      options: BASE_OPTIONS,
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
      options: BASE_OPTIONS,
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
      options: BASE_OPTIONS,
      flowPath: fixturePath("launch"),
    });

    expect(closeMock).toHaveBeenCalled();
    expect(browserCloseMock).toHaveBeenCalled();
  });

  it("should not retry when failWithoutRetry is called", async () => {
    const result = await runWebFlow({
      deps: makeWebDeps(),
      options: { ...BASE_OPTIONS, retries: 2 },
      flowPath: fixturePath("failNoRetry"),
    });

    expect(result.passed).toBe(false);
    expect(result.attempts).toBe(1);
  });

  it("should fail the flow when an unsupported dependency is called", async () => {
    const result = await runWebFlow({
      deps: makeWebDeps(),
      options: BASE_OPTIONS,
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
      options: { ...BASE_OPTIONS, retries: 2 },
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
        options: BASE_OPTIONS,
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
      options: BASE_OPTIONS,
      flowPath: fixturePath("failAfterLaunch"),
    });

    expect(closeMock).toHaveBeenCalled();
    expect(browserCloseMock).toHaveBeenCalled();
  });
});
