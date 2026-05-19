import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { CommandContext } from "~/shell/commandContext.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import { handleFlowsRun, type HandleFlowsRunDeps } from "./runDefaults.js";

// handleFlowsRun accepts injectable deps, so no mock.module() is needed.

const expandPatternsMock =
  mock<(patterns: string[], cwd?: string) => Promise<string[]>>();
const resolveUniqueEnvDirMock = mock<(files: string[]) => string | undefined>();
const ensureFlowDepsMock = mock<(envDir: string) => Promise<void>>();
const configureTestkitMock = mock<(dir: string) => Promise<void>>();
const flowsRunMock = mock<HandleFlowsRunDeps["flowsRun"]>();
const runWebFlowDepsMock = mock<(...args: unknown[]) => Promise<unknown>>();

const trackedMocks = [
  expandPatternsMock,
  resolveUniqueEnvDirMock,
  ensureFlowDepsMock,
  configureTestkitMock,
  flowsRunMock,
  runWebFlowDepsMock,
];

function makeDeps(): HandleFlowsRunDeps {
  return {
    expandPatterns: expandPatternsMock,
    resolveUniqueEnvDir: resolveUniqueEnvDirMock,
    ensureFlowDeps: ensureFlowDepsMock,
    configureTestkit: configureTestkitMock,
    flowsRun: flowsRunMock,
    runWebFlowDeps:
      runWebFlowDepsMock as unknown as HandleFlowsRunDeps["runWebFlowDeps"],
  };
}

function defaultFlags(): FlowsRunFlags {
  return {
    retries: 0,
    bail: false,
    workers: 1,
    timeout: 30_000,
    video: "off",
    trace: "off",
    outputDir: "/tmp",
    headed: false,
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

beforeEach(() => {
  for (const m of trackedMocks) m.mockClear();
  expandPatternsMock.mockResolvedValue([]);
  resolveUniqueEnvDirMock.mockReturnValue(undefined);
  ensureFlowDepsMock.mockResolvedValue(undefined);
  configureTestkitMock.mockResolvedValue(undefined);
  flowsRunMock.mockResolvedValue(undefined);
  runWebFlowDepsMock.mockResolvedValue({});
});

describe("handleFlowsRun", () => {
  it("returns error with exitCode 2 when resolveUniqueEnvDir throws", async () => {
    expandPatternsMock.mockResolvedValue(["/some/file.flow.ts"]);
    resolveUniqueEnvDirMock.mockImplementation(() => {
      throw new Error("files span multiple env dirs");
    });

    const result = await handleFlowsRun(
      makeCtx(),
      undefined,
      defaultFlags(),
      makeDeps(),
    );

    expect(result).toEqual({
      error: "files span multiple env dirs",
      exitCode: 2,
    });
    expect(ensureFlowDepsMock).not.toHaveBeenCalled();
    expect(flowsRunMock).not.toHaveBeenCalled();
  });

  it("skips env setup and calls flowsRun when no envDir", async () => {
    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(ensureFlowDepsMock).not.toHaveBeenCalled();
    expect(configureTestkitMock).toHaveBeenCalledTimes(1);
    expect(flowsRunMock).toHaveBeenCalledTimes(1);
  });

  it("calls ensureFlowDeps and configureTestkit with envDir when envDir is present", async () => {
    const envDir = "/mock/.qawolf/env1";
    expandPatternsMock.mockResolvedValue([`${envDir}/login.flow.ts`]);
    resolveUniqueEnvDirMock.mockReturnValue(envDir);

    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(ensureFlowDepsMock).toHaveBeenCalledWith(envDir);
    expect(configureTestkitMock).toHaveBeenCalledWith(envDir);
    expect(flowsRunMock).toHaveBeenCalledTimes(1);
  });
});
