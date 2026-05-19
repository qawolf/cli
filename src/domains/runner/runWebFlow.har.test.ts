import { afterEach, describe, expect, it, mock } from "bun:test";
import type { RunnerDeps } from "./types.js";
import type { ContextSetupOptions, WebLaunchDeps } from "./web/types.js";
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
    fs: {
      mkdir: async () => {},
      writeFile: async () => {},
      unlink: async () => {},
    },
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

const baseOptions: RunWebFlowOptions = {
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

describe("runWebFlow HAR", () => {
  it("should not pass recordHar to newContext when har is off", async () => {
    const ctx = makeContext([makePage()]);
    const newContextMock = mock(async (_opts: ContextSetupOptions) => ctx);
    const browser = makeBrowser(ctx);
    browser.newContext = newContextMock;
    const deps = makeWebDeps(makeUniformDeps(makeDep(browser, ctx)));

    await runWebFlow({
      deps,
      options: baseOptions,
      flowPath: fixturePath("launch"),
    });

    const arg = newContextMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg["recordHar"]).toBeUndefined();
  });

  it("should pass recordHar to newContext when har is on", async () => {
    const ctx = makeContext([makePage()]);
    const newContextMock = mock(async (_opts: ContextSetupOptions) => ctx);
    const browser = makeBrowser(ctx);
    browser.newContext = newContextMock;
    const deps = makeWebDeps(makeUniformDeps(makeDep(browser, ctx)));

    await runWebFlow({
      deps,
      options: {
        ...baseOptions,
        har: "on",
        harContent: "omit",
        outputDir: "/tmp/test-har",
      },
      flowPath: fixturePath("launch"),
    });

    type Arg = { recordHar?: { path: string; mode: string; content: string } };
    const arg = newContextMock.mock.calls[0]![0] as Arg;
    expect(arg.recordHar?.path).toContain("/har/launch.har");
    expect(arg.recordHar?.mode).toBe("minimal");
    expect(arg.recordHar?.content).toBe("omit");
  });

  it("should delete the HAR file on success when har is retain-on-failure", async () => {
    const unlinkMock = mock(async (_p: string) => {});
    const deps = {
      ...makeWebDeps(),
      fs: {
        mkdir: async () => {},
        writeFile: async () => {},
        unlink: unlinkMock,
      },
    };

    await runWebFlow({
      deps,
      options: {
        ...baseOptions,
        har: "retain-on-failure",
        harContent: "omit",
        outputDir: "/tmp/test-har",
      },
      flowPath: fixturePath("pass"),
    });

    expect(unlinkMock.mock.calls[0]![0]).toContain("/har/");
  });

  it("should not delete the HAR file on failure when har is retain-on-failure", async () => {
    const unlinkMock = mock(async (_p: string) => {});
    const deps = {
      ...makeWebDeps(),
      fs: {
        mkdir: async () => {},
        writeFile: async () => {},
        unlink: unlinkMock,
      },
    };

    await runWebFlow({
      deps,
      options: {
        ...baseOptions,
        har: "retain-on-failure",
        harContent: "omit",
        outputDir: "/tmp/test-har",
      },
      flowPath: fixturePath("fail"),
    });

    expect(unlinkMock).not.toHaveBeenCalled();
  });
});
