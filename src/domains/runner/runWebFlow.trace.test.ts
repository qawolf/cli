import { join } from "node:path";
import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  makeBrowser,
  makeContext,
  makeDep,
  makePage,
  makeUniformDeps,
} from "./web/createWebLaunchContext.fixtures.js";
import { runWebFlow } from "./runWebFlow.js";
import {
  baseOptions,
  fixturePath,
  makeWebDeps,
} from "./runWebFlow.fixtures.js";

afterEach(() => {
  mock.restore();
});

describe("runWebFlow trace", () => {
  it("should not start tracing when trace is off", async () => {
    const ctx = makeContext([makePage()]);
    const startMock = mock(async () => {});
    ctx.tracing = { start: startMock, stop: async () => {} };
    const deps = makeWebDeps(makeUniformDeps(makeDep(makeBrowser(ctx), ctx)));

    await runWebFlow({
      deps,
      options: baseOptions,
      flowPath: fixturePath("launch"),
    });

    expect(startMock).not.toHaveBeenCalled();
  });

  it("should start and stop tracing to the trace path when trace is on", async () => {
    const ctx = makeContext([makePage()]);
    const startMock = mock(async () => {});
    const stopMock = mock(async (_opts: { path?: string }) => {});
    ctx.tracing = { start: startMock, stop: stopMock };
    const deps = makeWebDeps(makeUniformDeps(makeDep(makeBrowser(ctx), ctx)));

    await runWebFlow({
      deps,
      options: { ...baseOptions, trace: "on", outputDir: "/tmp/test-trace" },
      flowPath: fixturePath("launch"),
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    const stopArg = stopMock.mock.calls[0]![0];
    expect(stopArg.path).toBe(join("/tmp/test-trace", "trace", "launch.zip"));
  });

  it("should delete the trace file on success when trace is retain-on-failure", async () => {
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
        trace: "retain-on-failure",
        outputDir: "/tmp/test-trace",
      },
      // Cleanup targets paths assigned to real contexts, so the flow must
      // launch a browser for a trace file to exist.
      flowPath: fixturePath("launch"),
    });

    expect(unlinkMock.mock.calls[0]![0]).toBe(
      join("/tmp/test-trace", "trace", "launch.zip"),
    );
  });

  it("should not delete the trace file on failure when trace is retain-on-failure", async () => {
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
        trace: "retain-on-failure",
        outputDir: "/tmp/test-trace",
      },
      flowPath: fixturePath("fail"),
    });

    expect(unlinkMock).not.toHaveBeenCalled();
  });
});
