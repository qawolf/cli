import { afterEach, describe, expect, it, mock } from "bun:test";
import type { Logger } from "~/shell/logger.js";
import { dispatchFlow } from "./dispatchFlow.js";
import type { FlowsRunDeps, WebResolvedFlow } from "./runInternals.js";
import { makeDeps, passResult, failResult } from "./run.fixtures.js";

afterEach(() => {
  mock.restore();
});

function makeLogger(): Logger {
  return {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
    trace: mock(() => {}),
  };
}

function makeDispatchDeps(logger?: Logger): FlowsRunDeps {
  const base = makeDeps({ runResults: [passResult()] });
  return logger !== undefined ? { ...base, logger } : base;
}

const webFlow: WebResolvedFlow = {
  kind: "web",
  file: "/proj/my-flow.ts",
  name: "my-flow",
  browser: "chromium",
};

describe("dispatchFlow logger", () => {
  it("should call logger.info with flow name before dispatch", async () => {
    const logger = makeLogger();
    const deps = makeDispatchDeps(logger);
    await dispatchFlow({
      deps,
      flow: webFlow,
      webOptions: {} as Parameters<typeof dispatchFlow>[0]["webOptions"],
      androidOptions: {} as Parameters<
        typeof dispatchFlow
      >[0]["androidOptions"],
    });
    expect(logger.info).toHaveBeenCalledWith(`run: ${webFlow.name}`);
  });

  it("should call logger.info with pass result after dispatch", async () => {
    const logger = makeLogger();
    const deps = makeDispatchDeps(logger);
    await dispatchFlow({
      deps,
      flow: webFlow,
      webOptions: {} as Parameters<typeof dispatchFlow>[0]["webOptions"],
      androidOptions: {} as Parameters<
        typeof dispatchFlow
      >[0]["androidOptions"],
    });
    const calls = (logger.info as ReturnType<typeof mock>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(
      calls.some((m) => /^pass: my-flow \(\d+ms, 1 attempt\)$/.test(m)),
    ).toBe(true);
  });

  it("should call logger.info with fail result after dispatch", async () => {
    const logger = makeLogger();
    const deps: FlowsRunDeps = {
      ...makeDeps({ runResults: [failResult()] }),
      logger,
    };
    await dispatchFlow({
      deps,
      flow: webFlow,
      webOptions: {} as Parameters<typeof dispatchFlow>[0]["webOptions"],
      androidOptions: {} as Parameters<
        typeof dispatchFlow
      >[0]["androidOptions"],
    });
    const calls = (logger.info as ReturnType<typeof mock>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(
      calls.some((m) => /^fail: my-flow \(\d+ms, 1 attempt\)$/.test(m)),
    ).toBe(true);
  });

  it("should not throw when logger dep is absent", async () => {
    const deps = makeDispatchDeps();
    const result = await dispatchFlow({
      deps,
      flow: webFlow,
      webOptions: {} as Parameters<typeof dispatchFlow>[0]["webOptions"],
      androidOptions: {} as Parameters<
        typeof dispatchFlow
      >[0]["androidOptions"],
    });
    expect(result.run.passed).toBe(true);
  });
});
