import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { CommandContext } from "~/shell/commandContext.js";
import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import type {
  FlowsRunDeps,
  FlowsRunFlags,
} from "~/domains/runner/runInternals.js";
import type { FlowRuntimeDeps } from "~/domains/runner/flowRuntimeDeps.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { runnerMessages } from "~/core/messages/index.js";
import { handleFlowsRun, type HandleFlowsRunDeps } from "./runDefaults.js";

const noopSignals = makeNoopSignals();

// handleFlowsRun accepts injectable deps, so no mock.module() is needed.

const expandPatternsMock = mock<HandleFlowsRunDeps["expandPatterns"]>();
const resolveUniqueEnvDirMock = mock<(files: string[]) => string | undefined>();
const ensureFlowDepsMock = mock<(envDir: string) => Promise<void>>();
const configureTestkitMock = mock<(dir: string) => Promise<void>>();
const flowsRunMock = mock<HandleFlowsRunDeps["flowsRun"]>();
const runWebFlowDepsMock = mock<(...args: unknown[]) => Promise<unknown>>();
const createFlowRuntimeDepsMock = mock<(...args: unknown[]) => unknown>();
const sharedFlowRuntimeDeps: FlowRuntimeDeps = {
  fetchLatestEnvironmentVariables: async () => {},
};
const uiInfoMock = mock<(message: string) => void>();
const uiIntroMock = mock<(title: string) => void>();

const trackedMocks = [
  expandPatternsMock,
  resolveUniqueEnvDirMock,
  ensureFlowDepsMock,
  configureTestkitMock,
  flowsRunMock,
  runWebFlowDepsMock,
  createFlowRuntimeDepsMock,
  uiInfoMock,
  uiIntroMock,
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
    createFlowRuntimeDeps:
      createFlowRuntimeDepsMock as unknown as HandleFlowsRunDeps["createFlowRuntimeDeps"],
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
    har: "off",
    harContent: "omit",
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
    signals: noopSignals,
    log: () => makeNoopLogger(),
    ui: { ...makeFakeUI("human"), info: uiInfoMock, intro: uiIntroMock },
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
  createFlowRuntimeDepsMock.mockReturnValue(sharedFlowRuntimeDeps);
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

  it("returns early and skips all setup when no flows match", async () => {
    const result = await handleFlowsRun(
      makeCtx(),
      undefined,
      defaultFlags(),
      makeDeps(),
    );

    expect(result).toBeUndefined();
    expect(uiInfoMock).toHaveBeenCalledWith(runnerMessages.noFlowsMatched);
    expect(ensureFlowDepsMock).not.toHaveBeenCalled();
    expect(configureTestkitMock).not.toHaveBeenCalled();
    expect(flowsRunMock).not.toHaveBeenCalled();
  });

  it("skips ensureFlowDeps when flows found but envDir is undefined", async () => {
    expandPatternsMock.mockResolvedValue(["/some/flow.ts"]);
    resolveUniqueEnvDirMock.mockReturnValue(undefined);

    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(ensureFlowDepsMock).not.toHaveBeenCalled();
    expect(configureTestkitMock).toHaveBeenCalledTimes(1);
    expect(flowsRunMock).toHaveBeenCalledTimes(1);
    expect(runWebFlowDepsMock).toHaveBeenCalledTimes(1);
    const runDeps = flowsRunMock.mock.calls[0]?.[3] as FlowsRunDeps;
    expect(runDeps.runWebFlowDeps.flowRuntimeDeps).toBe(sharedFlowRuntimeDeps);
    expect(
      runDeps.runAndroidFlowDeps !== "not-wired"
        ? runDeps.runAndroidFlowDeps.flowRuntimeDeps
        : undefined,
    ).toBe(sharedFlowRuntimeDeps);
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

  it("opens the run with an intro once flows are resolved", async () => {
    expandPatternsMock.mockResolvedValue(["/some/flow.ts"]);
    resolveUniqueEnvDirMock.mockReturnValue(undefined);

    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(uiIntroMock).toHaveBeenCalledWith("flows run");
  });

  it("does not open an intro when no flows match", async () => {
    expandPatternsMock.mockResolvedValue([]);

    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(uiIntroMock).not.toHaveBeenCalled();
  });
});
