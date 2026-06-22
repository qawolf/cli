import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { CommandContext } from "~/shell/commandContext.js";
import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { runnerMessages } from "~/core/messages/index.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { handleFlowsRun, type HandleFlowsRunDeps } from "./runDefaults.js";

const noopSignals = makeNoopSignals();

// handleFlowsRun accepts injectable deps, so no mock.module() is needed.

const expandPatternsMock = mock<HandleFlowsRunDeps["expandPatterns"]>();
const resolveDepsRootMock = mock<HandleFlowsRunDeps["resolveDepsRoot"]>();
const configureTestkitMock = mock<(dir: string) => Promise<void>>();
const flowsRunMock = mock<HandleFlowsRunDeps["flowsRun"]>();
const runWebFlowDepsMock = mock<(...args: unknown[]) => Promise<unknown>>();
const uiInfoMock = mock<(message: string) => void>();
const uiIntroMock = mock<(title: string) => void>();
const uiNoteMock = mock<(message: string, title?: string) => void>();

const trackedMocks = [
  expandPatternsMock,
  resolveDepsRootMock,
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
    resolveDepsRoot: resolveDepsRootMock,
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
    fs: makeMemoryFs(),
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
  resolveDepsRootMock.mockResolvedValue({
    depsRoot: "/env",
    source: "project",
    installed: false,
  });
  configureTestkitMock.mockResolvedValue(undefined);
  flowsRunMock.mockResolvedValue(undefined);
  runWebFlowDepsMock.mockResolvedValue({});
});

describe("handleFlowsRun", () => {
  it("uses the managed dir resolved by resolveDepsRoot for multi-package patterns", async () => {
    expandPatternsMock.mockResolvedValue(["/some/file.flow.ts"]);
    resolveDepsRootMock.mockResolvedValue({
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
    expect(resolveDepsRootMock).toHaveBeenCalledWith({
      files: ["/some/file.flow.ts"],
    });
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
    expect(resolveDepsRootMock).not.toHaveBeenCalled();
    expect(configureTestkitMock).not.toHaveBeenCalled();
    expect(flowsRunMock).not.toHaveBeenCalled();
  });

  it("calls resolveDepsRoot with the expanded files and no overrideDir by default", async () => {
    expandPatternsMock.mockResolvedValue(["/some/flow.ts"]);

    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(resolveDepsRootMock).toHaveBeenCalledWith({
      files: ["/some/flow.ts"],
    });
    expect(configureTestkitMock).toHaveBeenCalledTimes(1);
    expect(flowsRunMock).toHaveBeenCalledTimes(1);
    expect(runWebFlowDepsMock).toHaveBeenCalledTimes(1);
  });

  it("configures testkit with the depsRoot returned by resolveDepsRoot", async () => {
    const envDir = "/mock/.qawolf/env1";
    expandPatternsMock.mockResolvedValue([`${envDir}/login.flow.ts`]);
    resolveDepsRootMock.mockResolvedValue({
      depsRoot: envDir,
      source: "project",
      installed: false,
    });

    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(resolveDepsRootMock).toHaveBeenCalledWith({
      files: [`${envDir}/login.flow.ts`],
    });
    expect(configureTestkitMock).toHaveBeenCalledWith(envDir);
    expect(flowsRunMock).toHaveBeenCalledTimes(1);
  });

  it("emits managed runtime note when resolveDepsRoot source is managed", async () => {
    expandPatternsMock.mockResolvedValue(["/some/flow.ts"]);
    resolveDepsRootMock.mockResolvedValue({
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
    resolveDepsRootMock.mockResolvedValue({
      depsRoot: "/env",
      source: "project",
      installed: false,
    });

    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(uiNoteMock).not.toHaveBeenCalled();
  });

  it("threads --deps flag to resolveDepsRoot as overrideDir", async () => {
    expandPatternsMock.mockResolvedValue(["/some/flow.ts"]);
    resolveDepsRootMock.mockResolvedValue({
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

    expect(resolveDepsRootMock).toHaveBeenCalledWith({
      files: ["/some/flow.ts"],
      overrideDir: "/custom/deps",
    });
  });

  it("opens the run with an intro once flows are resolved", async () => {
    expandPatternsMock.mockResolvedValue(["/some/flow.ts"]);

    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(uiIntroMock).toHaveBeenCalledWith("flows run");
  });

  it("does not open an intro when no flows match", async () => {
    expandPatternsMock.mockResolvedValue([]);

    await handleFlowsRun(makeCtx(), undefined, defaultFlags(), makeDeps());

    expect(uiIntroMock).not.toHaveBeenCalled();
  });
});
