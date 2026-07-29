// oxlint-disable eslint/max-lines -- adding the project-staging coverage pushed this past 250; splitting the handleHybridFlowsRun suite would fragment its coverage story
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import type { FlowRuntimeDeps } from "~/domains/runner/flowRuntimeDeps.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { runStagingRoot } from "~/domains/runtimeEnv/index.js";
import {
  handleHybridFlowsRun,
  type HandleHybridFlowsRunDeps,
} from "./hybridRunDefaults.js";

afterEach(() => {
  mock.restore();
});

const expandPatternsMock = mock<HandleHybridFlowsRunDeps["expandPatterns"]>();
const pullEnvMock = mock<HandleHybridFlowsRunDeps["pullEnv"]>();
const resolveDepsRootMock = mock<HandleHybridFlowsRunDeps["resolveDepsRoot"]>();
const prepareRunDirMock = mock<HandleHybridFlowsRunDeps["prepareRunDir"]>();
const configureTestkitMock = mock<(dir: string) => Promise<void>>();
const flowsRunMock = mock<HandleHybridFlowsRunDeps["flowsRun"]>();
const runWebFlowDepsMock = mock<() => Promise<unknown>>();
const createFlowRuntimeDepsMock = mock<(...args: unknown[]) => unknown>();
const sharedFlowRuntimeDeps: FlowRuntimeDeps = {
  fetchLatestEnvironmentVariables: async () => {},
};

const trackedMocks = [
  expandPatternsMock,
  pullEnvMock,
  resolveDepsRootMock,
  prepareRunDirMock,
  configureTestkitMock,
  flowsRunMock,
  runWebFlowDepsMock,
  createFlowRuntimeDepsMock,
];

beforeEach(() => {
  for (const m of trackedMocks) m.mockClear();
  expandPatternsMock.mockResolvedValue([]);
  pullEnvMock.mockResolvedValue(undefined);
  resolveDepsRootMock.mockResolvedValue({
    depsRoot: "/env",
    source: "project",
    installed: false,
  });
  prepareRunDirMock.mockResolvedValue({
    files: [],
    runDir: "/mock/run",
    outerHop: { mode: "none" },
    cleanup: async () => {},
  });
  configureTestkitMock.mockResolvedValue(undefined);
  flowsRunMock.mockResolvedValue(undefined);
  runWebFlowDepsMock.mockResolvedValue({} as unknown);
  createFlowRuntimeDepsMock.mockReturnValue(sharedFlowRuntimeDeps);
});

function makeCtx(): AuthCommandContext {
  return {
    configDir: "/mock/config",
    apiBaseUrl: "https://app.qawolf.com",
    outputMode: "human",
    isInteractive: false,
    apiKeySource: "env",
    platform: {} as unknown,
    fs: makeMemoryFs(),
    signals: makeNoopSignals(),
    ui: makeFakeUI("human"),
    log: () => makeNoopLogger(),
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
    browserDeps: true,
  };
}

function makeDeps(): HandleHybridFlowsRunDeps {
  return {
    expandPatterns: expandPatternsMock,
    pullEnv: pullEnvMock,
    resolveDepsRoot: resolveDepsRootMock,
    prepareRunDir: prepareRunDirMock,
    configureTestkit: configureTestkitMock,
    flowsRun: flowsRunMock,
    runWebFlowDeps:
      runWebFlowDepsMock as unknown as HandleHybridFlowsRunDeps["runWebFlowDeps"],
    createFlowRuntimeDeps:
      createFlowRuntimeDepsMock as unknown as HandleHybridFlowsRunDeps["createFlowRuntimeDeps"],
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
    prepareRunDirMock.mockResolvedValue({
      files: ["/mock/.qawolf/my-env/login.flow.ts"],
      runDir: "/mock/run",
      outerHop: { mode: "none" },
      cleanup: async () => {},
    });

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
      expect.anything(),
    );
    expect(flowsRunMock).toHaveBeenCalledWith(
      expect.anything(),
      ["/mock/.qawolf/my-env/login.flow.ts"],
      expect.anything(),
      expect.anything(),
    );
    expect(flowsRunMock.mock.calls[0]?.[3].logger).toBeDefined();
  });

  it("calls prepareRunDir with expanded files, depsRoot, and the sibling run-staging root", async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    const envDir = "/mock/.qawolf/my-env";
    expandPatternsMock.mockResolvedValue([`${envDir}/login.flow.ts`]);
    resolveDepsRootMock.mockResolvedValue({
      depsRoot: "/managed",
      source: "managed",
      installed: true,
    });

    await handleHybridFlowsRun(
      ctx,
      "**/login.flow.ts",
      { ...defaultFlags(), env: "my-env" },
      deps,
    );

    expect(prepareRunDirMock).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [`${envDir}/login.flow.ts`],
        projectDir: undefined,
        depsRoot: "/managed",
        runRoot: runStagingRoot(),
      }),
    );
  });

  it("passes staged files from prepareRunDir to flowsRun", async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    expandPatternsMock.mockResolvedValue([
      "/mock/.qawolf/my-env/login.flow.ts",
    ]);
    prepareRunDirMock.mockResolvedValue({
      files: ["/mock/run/exec/login.flow.ts"],
      runDir: "/mock/run",
      outerHop: { mode: "none" },
      cleanup: async () => {},
    });

    await handleHybridFlowsRun(
      ctx,
      "**/login.flow.ts",
      { ...defaultFlags(), env: "my-env" },
      deps,
    );

    expect(flowsRunMock).toHaveBeenCalledWith(
      expect.anything(),
      ["/mock/run/exec/login.flow.ts"],
      expect.anything(),
      expect.anything(),
    );
  });

  it("calls staged cleanup after flowsRun completes", async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    expandPatternsMock.mockResolvedValue([
      "/mock/.qawolf/my-env/login.flow.ts",
    ]);
    const cleanup = mock<() => Promise<void>>();
    cleanup.mockResolvedValue(undefined);
    prepareRunDirMock.mockResolvedValue({
      files: ["/mock/.qawolf/my-env/login.flow.ts"],
      runDir: "/mock/run",
      outerHop: { mode: "none" },
      cleanup,
    });

    await handleHybridFlowsRun(
      ctx,
      "**/login.flow.ts",
      { ...defaultFlags(), env: "my-env" },
      deps,
    );

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("pulls env on cache miss and runs matched files", async () => {
    const ctx = makeCtx();
    const deps = makeDeps();
    expandPatternsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(["/mock/.qawolf/my-env/login.flow.ts"]);
    pullEnvMock.mockResolvedValue(undefined);
    prepareRunDirMock.mockResolvedValue({
      files: ["/mock/.qawolf/my-env/login.flow.ts"],
      runDir: "/mock/run",
      outerHop: { mode: "none" },
      cleanup: async () => {},
    });

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
    prepareRunDirMock.mockResolvedValue({
      files: [
        "/mock/.qawolf/my-env/a.flow.ts",
        "/mock/.qawolf/my-env/b.flow.ts",
      ],
      runDir: "/mock/run",
      outerHop: { mode: "none" },
      cleanup: async () => {},
    });

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
    expect(expandPatternsMock).toHaveBeenCalledWith(
      [],
      expect.any(String),
      expect.anything(),
    );
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
