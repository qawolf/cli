import { join } from "node:path";
import { afterEach, describe, expect, it, mock } from "bun:test";
import type { ContextSetupOptions } from "./web/types.js";
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
    expect(arg.recordHar?.path).toBe(
      join("/tmp/test-har", "har", "launch.har"),
    );
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
      // Cleanup targets paths assigned to real contexts, so the flow must
      // launch a browser for a HAR file to exist.
      flowPath: fixturePath("launch"),
    });

    expect(unlinkMock.mock.calls[0]![0]).toBe(
      join("/tmp/test-har", "har", "launch.har"),
    );
  });

  it("should delete every per-context HAR file on success when har is retain-on-failure", async () => {
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
      flowPath: fixturePath("ownContext"),
    });

    const unlinked = unlinkMock.mock.calls.map((c) => c[0]);
    expect(unlinked).toContain(join("/tmp/test-har", "har", "ownContext.har"));
    expect(unlinked).toContain(
      join("/tmp/test-har", "har", "ownContext-2.har"),
    );
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
