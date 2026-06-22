import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { CommandContext } from "~/shell/commandContext.js";
import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { runnerMessages } from "~/core/messages/index.js";
import { handleFlowsRun, type HandleFlowsRunDeps } from "./runDefaults.js";

const noopSignals = makeNoopSignals();

// handleFlowsRun accepts injectable deps, so no mock.module() is needed.

const expandPatternsMock = mock<HandleFlowsRunDeps["expandPatterns"]>();
const resolveUniqueEnvDirMock = mock<(files: string[]) => string | undefined>();
const ensureRuntimeEnvMock = mock<HandleFlowsRunDeps["ensureRuntimeEnv"]>();
const configureTestkitMock = mock<(dir: string) => Promise<void>>();
const flowsRunMock = mock<HandleFlowsRunDeps["flowsRun"]>();
const runWebFlowDepsMock = mock<(...args: unknown[]) => Promise<unknown>>();
const uiInfoMock = mock<(message: string) => void>();
const uiIntroMock = mock<(title: string) => void>();
const uiNoteMock = mock<(message: string, title?: string) => void>();

const trackedMocks = [
  expandPatternsMock,
  resolveUniqueEnvDirMock,
  ensureRuntimeEnvMock,
  configureTestkitMock,
  flowsRunMock,
  runWebFlowDepsMock,
  uiInfoMock,
  uiIntroMock,
  uiNoteMock,
];

function makeDeps(): HandleFlowsRunDeps {
  return {
    expandPatterns: expandPatternsMock,
    resolveUniqueEnvDir: resolveUniqueEnvDirMock,
    ensureRuntimeEnv: ensureRuntimeEnvMock,
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
    ui: {
      ...makeFakeUI("human"),
      info: uiInfoMock,
      intro: uiIntroMock,
      note: uiNoteMock,
    },
  } as unknown as CommandContext;
}

beforeEach(() => {
  for (const m of trackedMocks) m.mockClear();
  expandPatternsMock.mockResolvedValue([]);
  resolveUniqueEnvDirMock.mockReturnValue(undefined);
  ensureRuntimeEnvMock.mockResolvedValue({
    depsRoot: "/env",
    source: "project",
    installed: false,
  });
  configureTestkitMock.mockResolvedValue(undefined);
  flowsRunMock.mockResolvedValue(undefined);
  runWebFlowDepsMock.mockResolvedValue({});
});

describe("handleFlowsRun", () => {
  it("proceeds with managed dir when resolveUniqueEnvDir throws", async () => {
    expandPatternsMock.mockResolvedValue(["/some/file.flow.ts"]);
    resolveUniqueEnvDirMock.mockImplementation(() => {
      throw new Error("files span multiple env dirs");
    });
    ensureRuntimeEnvMock.mockResolvedValue({
      depsRoot: "/managed",
      source: "managed",
      installed: true,
    });

    const result = await handleFlowsRun(
      makeCtx(),
      undefined,
      defaultFlags(),
      makeDeps(),
    );

    expect(result).toBeUndefined();
    expect(ensureRuntimeEnvMock).toHaveBeenCalledWith({});
    expect(flowsRunMock).toHaveBeenCalledTimes(1);
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
    expect(ensureRuntimeEnvMock).not.toHaveBeenCalled();
    expect(configureTestkitMock).not.toHaveBeenCalled();
    expect(flowsRunMock).not.toHaveBeenCalled();
  });

  it("calls ensureRuntimeEnv with undefined projectDir when resolveUniqueEnvDir returns undefined", async () => {
    expandPatternsMock.mockResolvedValue(["/some/flow.ts"]);
    resolveUniqueEnvDirMock.mockReturnValue(undefined);

    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(ensureRuntimeEnvMock).toHaveBeenCalledWith({});
    expect(configureTestkitMock).toHaveBeenCalledTimes(1);
    expect(flowsRunMock).toHaveBeenCalledTimes(1);
    expect(runWebFlowDepsMock).toHaveBeenCalledTimes(1);
  });

  it("calls ensureRuntimeEnv with resolved projectDir and configureTestkit with depsRoot", async () => {
    const envDir = "/mock/.qawolf/env1";
    expandPatternsMock.mockResolvedValue([`${envDir}/login.flow.ts`]);
    resolveUniqueEnvDirMock.mockReturnValue(envDir);
    ensureRuntimeEnvMock.mockResolvedValue({
      depsRoot: envDir,
      source: "project",
      installed: false,
    });

    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(ensureRuntimeEnvMock).toHaveBeenCalledWith({ projectDir: envDir });
    expect(configureTestkitMock).toHaveBeenCalledWith(envDir);
    expect(flowsRunMock).toHaveBeenCalledTimes(1);
  });

  it("emits managed runtime note when ensureRuntimeEnv source is managed", async () => {
    expandPatternsMock.mockResolvedValue(["/some/flow.ts"]);
    ensureRuntimeEnvMock.mockResolvedValue({
      depsRoot: "/home/.qawolf/runtime",
      source: "managed",
      installed: false,
    });

    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(uiNoteMock).toHaveBeenCalledWith(
      runnerMessages.managedRuntimeNote("/home/.qawolf/runtime"),
      "Runtime",
    );
  });

  it("does not emit managed runtime note when source is project", async () => {
    expandPatternsMock.mockResolvedValue(["/some/flow.ts"]);
    ensureRuntimeEnvMock.mockResolvedValue({
      depsRoot: "/env",
      source: "project",
      installed: false,
    });

    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(uiNoteMock).not.toHaveBeenCalled();
  });

  it("threads --deps flag to ensureRuntimeEnv as overrideDir", async () => {
    expandPatternsMock.mockResolvedValue(["/some/flow.ts"]);
    ensureRuntimeEnvMock.mockResolvedValue({
      depsRoot: "/custom/deps",
      source: "override",
      installed: false,
    });

    await handleFlowsRun(
      makeCtx(),
      undefined,
      { ...defaultFlags(), deps: "/custom/deps" },
      makeDeps(),
    );

    expect(ensureRuntimeEnvMock).toHaveBeenCalledWith({
      overrideDir: "/custom/deps",
    });
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
