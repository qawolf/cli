import { beforeEach, describe, expect, it, mock } from "bun:test";

import { runnerMessages } from "~/core/messages/index.js";
import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import type { CommandContext } from "~/shell/commandContext.js";
import { makeFakeUI } from "~/shell/commandContext.testUtils.js";

import { runStagedFlows, type StagedRunDeps } from "./runStagedFlows.js";

const noopSignals = makeNoopSignals();

const resolveDepsRootMock = mock<StagedRunDeps["resolveDepsRoot"]>();
const prepareRunDirMock = mock<StagedRunDeps["prepareRunDir"]>();
const configureTestkitMock = mock<StagedRunDeps["configureTestkit"]>();
const flowsRunMock = mock<StagedRunDeps["flowsRun"]>();
const runWebFlowDepsMock = mock<(...args: unknown[]) => Promise<unknown>>();
const createFlowRuntimeDepsMock =
  mock<StagedRunDeps["createFlowRuntimeDeps"]>();
const cleanupMock = mock<() => Promise<void>>();
const uiInfoMock = mock<(message: string) => void>();
const debugMock = mock<(message: string) => void>();

const trackedMocks = [
  resolveDepsRootMock,
  prepareRunDirMock,
  configureTestkitMock,
  flowsRunMock,
  runWebFlowDepsMock,
  createFlowRuntimeDepsMock,
  cleanupMock,
  uiInfoMock,
  debugMock,
];

function makeDeps(): StagedRunDeps {
  return {
    resolveDepsRoot: resolveDepsRootMock,
    prepareRunDir: prepareRunDirMock,
    configureTestkit: configureTestkitMock,
    flowsRun: flowsRunMock,
    runWebFlowDeps:
      runWebFlowDepsMock as unknown as StagedRunDeps["runWebFlowDeps"],
    createFlowRuntimeDeps: createFlowRuntimeDepsMock,
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
    browserDeps: true,
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
    log: () => ({ ...makeNoopLogger(), debug: debugMock }),
    ui: { ...makeFakeUI("human"), info: uiInfoMock },
  } as unknown as CommandContext;
}

beforeEach(() => {
  for (const m of trackedMocks) m.mockClear();
  cleanupMock.mockResolvedValue(undefined);
  resolveDepsRootMock.mockResolvedValue({
    depsRoot: "/env",
    source: "project",
    installed: false,
  });
  prepareRunDirMock.mockResolvedValue({
    files: ["/mock/run/exec/flow.ts"],
    runDir: "/mock/run",
    outerHop: { mode: "none" },
    cleanup: cleanupMock,
  });
  configureTestkitMock.mockResolvedValue(undefined);
  flowsRunMock.mockResolvedValue(undefined);
  runWebFlowDepsMock.mockResolvedValue({});
  createFlowRuntimeDepsMock.mockResolvedValue({});
});

describe("runStagedFlows", () => {
  it("runs the staged files and cleans up the run dir on success", async () => {
    await runStagedFlows({
      ctx: makeCtx(),
      files: ["/some/flow.ts"],
      flags: defaultFlags(),
      deps: makeDeps(),
    });

    expect(flowsRunMock).toHaveBeenCalledWith(
      expect.anything(),
      ["/mock/run/exec/flow.ts"],
      expect.anything(),
      expect.anything(),
    );
    expect(cleanupMock).toHaveBeenCalledTimes(1);
  });

  it("still cleans up the run dir when flowsRun throws", async () => {
    flowsRunMock.mockRejectedValue(new Error("boom"));

    let caughtError: unknown;
    try {
      await runStagedFlows({
        ctx: makeCtx(),
        files: ["/some/flow.ts"],
        flags: defaultFlags(),
        deps: makeDeps(),
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toBe("boom");
    expect(cleanupMock).toHaveBeenCalledTimes(1);
  });

  it("cleans up the run dir when setup throws before flow execution", async () => {
    configureTestkitMock.mockRejectedValue(new Error("testkit failed"));

    let caughtError: unknown;
    try {
      await runStagedFlows({
        ctx: makeCtx(),
        files: ["/some/flow.ts"],
        flags: defaultFlags(),
        deps: makeDeps(),
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect(flowsRunMock).not.toHaveBeenCalled();
    expect(cleanupMock).toHaveBeenCalledTimes(1);
  });

  it("notes the managed runtime when resolveDepsRoot resolves a managed dir", async () => {
    resolveDepsRootMock.mockResolvedValue({
      depsRoot: "/home/.qawolf/runtime",
      source: "managed",
      installed: true,
    });

    await runStagedFlows({
      ctx: makeCtx(),
      files: ["/some/flow.ts"],
      flags: defaultFlags(),
      deps: makeDeps(),
    });

    expect(uiInfoMock).toHaveBeenCalledWith(
      runnerMessages.managedRuntimeNote("/home/.qawolf/runtime"),
    );
  });

  it("does not note a managed runtime when the source is the project dir", async () => {
    await runStagedFlows({
      ctx: makeCtx(),
      files: ["/some/flow.ts"],
      flags: defaultFlags(),
      deps: makeDeps(),
    });

    expect(uiInfoMock).not.toHaveBeenCalled();
  });

  it("threads the --deps override through to resolveDepsRoot", async () => {
    await runStagedFlows({
      ctx: makeCtx(),
      files: ["/some/flow.ts"],
      flags: { ...defaultFlags(), deps: "/custom/deps" },
      deps: makeDeps(),
    });

    expect(resolveDepsRootMock).toHaveBeenCalledWith({
      files: ["/some/flow.ts"],
      platform: process.platform,
      overrideDir: "/custom/deps",
    });
  });

  it("renders a status line when the outer-hop fallback install starts", async () => {
    await runStagedFlows({
      ctx: makeCtx(),
      files: ["/some/flow.ts"],
      flags: defaultFlags(),
      deps: makeDeps(),
    });

    const call = prepareRunDirMock.mock.calls[0]?.[0];
    expect(call?.onInstallStart).toBeDefined();
    call?.onInstallStart?.(3);
    expect(uiInfoMock).toHaveBeenCalledWith(
      runnerMessages.installingProjectDeps(3),
    );
  });

  it("debug-logs rejected outer-hop candidates when the fallback install ran", async () => {
    prepareRunDirMock.mockResolvedValue({
      files: ["/mock/run/exec/flow.ts"],
      runDir: "/mock/run",
      outerHop: {
        mode: "install",
        depCount: 1,
        rejected: [{ dir: "/host/node_modules", missing: ["date-fns"] }],
      },
      cleanup: cleanupMock,
    });

    await runStagedFlows({
      ctx: makeCtx(),
      files: ["/some/flow.ts"],
      flags: defaultFlags(),
      deps: makeDeps(),
    });

    expect(debugMock).toHaveBeenCalledWith(
      runnerMessages.outerHopCandidateRejected("/host/node_modules", [
        "date-fns",
      ]),
    );
  });
});
