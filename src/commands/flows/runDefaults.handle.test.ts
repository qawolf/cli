import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { CommandContext } from "~/shell/commandContext.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";

// mock.module must be called before the first import of runDefaults.ts.
// Each factory captures the mock function reference so call history can be
// inspected and reset between tests via mockClear().

const expandPatternsMock =
  mock<(patterns: string[], cwd?: string) => Promise<string[]>>();
const resolveUniqueEnvDirMock =
  mock<(files: readonly string[]) => string | undefined>();
const ensureFlowDepsMock = mock<(envDir: string) => Promise<void>>();
const configureTestkitMock = mock<(dir: string) => Promise<void>>();
const flowsRunMock = mock<(...args: unknown[]) => Promise<unknown>>();
const defaultRunWebFlowDepsMock = mock<(dir: string) => Promise<unknown>>();

await mock.module("~/domains/flows/expand.js", () => ({
  expandPatterns: expandPatternsMock,
  peekFlowMeta: mock(),
}));

await mock.module("~/domains/flows/ensureDeps.js", () => ({
  resolveUniqueEnvDir: resolveUniqueEnvDirMock,
  ensureFlowDeps: ensureFlowDepsMock,
}));

await mock.module("~/shell/testkit.js", () => ({
  configureTestkit: configureTestkitMock,
}));

await mock.module("~/domains/runner/run.js", () => ({
  flowsRun: flowsRunMock,
}));

await mock.module("~/domains/runner/runWebFlowDeps.js", () => ({
  defaultRunWebFlowDeps: defaultRunWebFlowDepsMock,
}));

await mock.module("~/shell/playwright.js", () => ({
  resolvePlaywrightCli: () => "/mock/playwright",
}));

await mock.module("~/shell/reporter/createConsoleReporter.js", () => ({
  createConsoleReporter: () => ({}),
}));

await mock.module("~/domains/runner/runWebFlow.js", () => ({
  runWebFlow: mock(),
}));

await mock.module("~/domains/runner/runAndroidFlow.js", () => ({
  runAndroidFlow: mock(),
}));

await mock.module("~/shell/spawn.js", () => ({
  defaultSpawn: mock(),
}));

await mock.module("~/domains/install/browsers.js", () => ({
  installBrowserList: mock(),
}));

const { handleFlowsRun } = await import("./runDefaults.js");

const trackedMocks = [
  expandPatternsMock,
  resolveUniqueEnvDirMock,
  ensureFlowDepsMock,
  configureTestkitMock,
  flowsRunMock,
  defaultRunWebFlowDepsMock,
];

function defaultFlags(): FlowsRunFlags {
  return {
    retries: 0,
    bail: false,
    workers: 1,
    timeout: 30_000,
    video: "off",
    trace: "off",
    outputDir: "/tmp",
  };
}

function makeCtx(): CommandContext {
  return {
    configDir: "/mock/config",
    apiBaseUrl: "https://app.qawolf.com",
    outputMode: "human",
    isInteractive: false,
    ui: {
      withProgress: async (tasks: { task: () => Promise<void> }[]) => {
        for (const t of tasks) await t.task();
        return [];
      },
    },
  } as unknown as CommandContext;
}

// Restore module mocks after all tests so they don't bleed into other test
// files when Bun runs multiple files in the same process.
afterAll(() => {
  mock.restore();
});

beforeEach(() => {
  for (const m of trackedMocks) m.mockClear();
  expandPatternsMock.mockResolvedValue([]);
  resolveUniqueEnvDirMock.mockReturnValue(undefined);
  ensureFlowDepsMock.mockResolvedValue(undefined);
  configureTestkitMock.mockResolvedValue(undefined);
  flowsRunMock.mockResolvedValue(undefined);
  defaultRunWebFlowDepsMock.mockResolvedValue({});
});

describe("handleFlowsRun", () => {
  it("returns error with exitCode 2 when resolveUniqueEnvDir throws", async () => {
    expandPatternsMock.mockResolvedValue(["/some/file.flow.ts"]);
    resolveUniqueEnvDirMock.mockImplementation(() => {
      throw new Error("files span multiple env dirs");
    });

    const result = await handleFlowsRun(makeCtx(), undefined, defaultFlags());

    expect(result).toEqual({
      error: "files span multiple env dirs",
      exitCode: 2,
    });
    expect(ensureFlowDepsMock).not.toHaveBeenCalled();
    expect(flowsRunMock).not.toHaveBeenCalled();
  });

  it("skips env setup and calls flowsRun when no envDir", async () => {
    await handleFlowsRun(makeCtx(), undefined, defaultFlags());

    expect(ensureFlowDepsMock).not.toHaveBeenCalled();
    expect(configureTestkitMock).toHaveBeenCalledTimes(1);
    expect(flowsRunMock).toHaveBeenCalledTimes(1);
  });

  it("calls ensureFlowDeps and configureTestkit with envDir when envDir is present", async () => {
    const envDir = "/mock/.qawolf/env1";
    expandPatternsMock.mockResolvedValue([`${envDir}/login.flow.ts`]);
    resolveUniqueEnvDirMock.mockReturnValue(envDir);

    await handleFlowsRun(makeCtx(), undefined, defaultFlags());

    expect(ensureFlowDepsMock).toHaveBeenCalledWith(envDir);
    expect(configureTestkitMock).toHaveBeenCalledWith(envDir);
    expect(flowsRunMock).toHaveBeenCalledTimes(1);
  });
});
