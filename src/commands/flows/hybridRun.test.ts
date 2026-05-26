import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { AuthCommandContext } from "~/shell/commandContext.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import {
  handleHybridFlowsRun,
  type HandleHybridFlowsRunDeps,
} from "./hybridRunDefaults.js";

afterEach(() => {
  mock.restore();
});

const expandPatternsMock =
  mock<(patterns: string[], cwd?: string) => Promise<string[]>>();
const pullEnvMock = mock<HandleHybridFlowsRunDeps["pullEnv"]>();
const ensureFlowDepsMock = mock<(envDir: string) => Promise<void>>();
const configureTestkitMock = mock<(dir: string) => Promise<void>>();
const flowsRunMock = mock<HandleHybridFlowsRunDeps["flowsRun"]>();
const runWebFlowDepsMock = mock<() => Promise<unknown>>();

const trackedMocks = [
  expandPatternsMock,
  pullEnvMock,
  ensureFlowDepsMock,
  configureTestkitMock,
  flowsRunMock,
  runWebFlowDepsMock,
];

beforeEach(() => {
  for (const m of trackedMocks) m.mockClear();
  expandPatternsMock.mockResolvedValue([]);
  pullEnvMock.mockResolvedValue(undefined);
  ensureFlowDepsMock.mockResolvedValue(undefined);
  configureTestkitMock.mockResolvedValue(undefined);
  flowsRunMock.mockResolvedValue(undefined);
  runWebFlowDepsMock.mockResolvedValue({} as unknown);
});

function makeCtx(): AuthCommandContext {
  return {
    configDir: "/mock/config",
    apiBaseUrl: "https://app.qawolf.com",
    outputMode: "human",
    isInteractive: false,
    apiKeySource: "env",
    platform: {} as unknown,
    signals: makeNoopSignals(),
    ui: {
      withProgress: async (
        tasks: { task: () => Promise<void> }[],
        _done: unknown,
      ) => {
        for (const t of tasks) await t.task();
        return [];
      },
    },
  } as unknown as AuthCommandContext;
}

function defaultFlags(): FlowsRunFlags {
  return {
    retries: 0,
    bail: false,
    workers: 1,
    timeout: 30_000,
    video: "off",
    trace: "off",
    har: "off",
    harContent: "omit",
    outputDir: "/tmp",
    headed: false,
  };
}

function makeDeps(): HandleHybridFlowsRunDeps {
  return {
    expandPatterns: expandPatternsMock,
    pullEnv: pullEnvMock,
    ensureFlowDeps: ensureFlowDepsMock,
    configureTestkit: configureTestkitMock,
    flowsRun: flowsRunMock,
    runWebFlowDeps:
      runWebFlowDepsMock as unknown as HandleHybridFlowsRunDeps["runWebFlowDeps"],
  };
}

describe("handleHybridFlowsRun", () => {
  it("returns error with exitCode 2 when env is not a valid ID", async () => {
    const result = await handleHybridFlowsRun(
      makeCtx(),
      undefined,
      { ...defaultFlags(), env: "INVALID ENV ID" },
      makeDeps(),
    );

    expect(result).toEqual({
      error: "--env must be a UUID or kebab-case slug (got: INVALID ENV ID)",
      exitCode: 2,
    });
    expect(expandPatternsMock).not.toHaveBeenCalled();
  });

  it("runs files from envDir directly when already cached", async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    expandPatternsMock.mockResolvedValue([
      "/mock/.qawolf/my-env/login.flow.ts",
    ]);

    await handleHybridFlowsRun(
      ctx,
      "**/login.flow.ts",
      { ...defaultFlags(), env: "my-env" },
      deps,
    );

    expect(pullEnvMock).not.toHaveBeenCalled();
    expect(expandPatternsMock).toHaveBeenCalledWith(
      ["**/login.flow.ts"],
      expect.any(String),
    );
    expect(flowsRunMock).toHaveBeenCalledWith(
      expect.anything(),
      ["/mock/.qawolf/my-env/login.flow.ts"],
      expect.anything(),
      expect.anything(),
    );
  });

  it("pulls env on cache miss and runs matched files", async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    expandPatternsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["/mock/.qawolf/my-env/login.flow.ts"]);
    pullEnvMock.mockResolvedValue(undefined);

    await handleHybridFlowsRun(
      ctx,
      "**/login.flow.ts",
      { ...defaultFlags(), env: "my-env" },
      deps,
    );

    expect(pullEnvMock).toHaveBeenCalledWith(ctx, "my-env");
    expect(expandPatternsMock).toHaveBeenCalledTimes(2);
    expect(flowsRunMock).toHaveBeenCalledWith(
      expect.anything(),
      ["/mock/.qawolf/my-env/login.flow.ts"],
      expect.anything(),
      expect.anything(),
    );
  });

  it("returns error when no flows match after pull", async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    expandPatternsMock.mockResolvedValue([]);
    pullEnvMock.mockResolvedValue(undefined);

    const result = await handleHybridFlowsRun(
      ctx,
      "**/missing.flow.ts",
      { ...defaultFlags(), env: "my-env" },
      deps,
    );

    expect(result).toEqual({
      error: "No flows matched '**/missing.flow.ts' in env 'my-env'",
      exitCode: 2,
    });
    expect(flowsRunMock).not.toHaveBeenCalled();
  });

  it("propagates pull error and skips re-glob and run", async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    expandPatternsMock.mockResolvedValue([]);
    pullEnvMock.mockResolvedValue({ error: "network error" });

    const result = await handleHybridFlowsRun(
      ctx,
      "**/login.flow.ts",
      { ...defaultFlags(), env: "my-env" },
      deps,
    );

    expect(result).toEqual({ error: "network error" });
    expect(expandPatternsMock).toHaveBeenCalledTimes(1);
    expect(flowsRunMock).not.toHaveBeenCalled();
  });

  it("runs all flows from envDir when pattern is undefined (cache hit)", async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    expandPatternsMock.mockResolvedValue([
      "/mock/.qawolf/my-env/a.flow.ts",
      "/mock/.qawolf/my-env/b.flow.ts",
    ]);

    await handleHybridFlowsRun(
      ctx,
      undefined,
      { ...defaultFlags(), env: "my-env" },
      deps,
    );

    expect(pullEnvMock).not.toHaveBeenCalled();
    expect(flowsRunMock).toHaveBeenCalledWith(
      expect.anything(),
      ["/mock/.qawolf/my-env/a.flow.ts", "/mock/.qawolf/my-env/b.flow.ts"],
      expect.anything(),
      expect.anything(),
    );
    expect(expandPatternsMock).toHaveBeenCalledWith([], expect.any(String));
  });

  it("returns error when no flows found in env after pull (pattern undefined)", async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    expandPatternsMock.mockResolvedValue([]);
    pullEnvMock.mockResolvedValue(undefined);

    const result = await handleHybridFlowsRun(
      ctx,
      undefined,
      { ...defaultFlags(), env: "my-env" },
      deps,
    );

    expect(result).toEqual({
      error: "No flows found in env 'my-env'",
      exitCode: 2,
    });
    expect(flowsRunMock).not.toHaveBeenCalled();
  });
});
