import { mock } from "bun:test";

import type { FlowsRunFlags } from "~/domains/runner/runInternals.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import type { CommandContext } from "~/shell/commandContext.js";
import { makeFakeUI } from "~/shell/commandContext.testUtils.js";

import { type StagedRunDeps } from "./runStagedFlows.js";

const noopSignals = makeNoopSignals();

export const resolveDepsRootMock = mock<StagedRunDeps["resolveDepsRoot"]>();
export const prepareRunDirMock = mock<StagedRunDeps["prepareRunDir"]>();
export const configureTestkitMock = mock<StagedRunDeps["configureTestkit"]>();
export const flowsRunMock = mock<StagedRunDeps["flowsRun"]>();
const runWebFlowDepsMock = mock<(...args: unknown[]) => Promise<unknown>>();
const createFlowRuntimeDepsMock =
  mock<StagedRunDeps["createFlowRuntimeDeps"]>();
export const cleanupMock = mock<() => Promise<void>>();
export const uiInfoMock = mock<(message: string) => void>();
export const uiWarnMock = mock<(message: string) => void>();
export const debugMock = mock<(message: string) => void>();

const trackedMocks = [
  resolveDepsRootMock,
  prepareRunDirMock,
  configureTestkitMock,
  flowsRunMock,
  runWebFlowDepsMock,
  createFlowRuntimeDepsMock,
  cleanupMock,
  uiInfoMock,
  uiWarnMock,
  debugMock,
];

export function makeDeps(): StagedRunDeps {
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

export function defaultFlags(): FlowsRunFlags {
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
    allowNoMatch: false,
  };
}

/**
 * A CommandContext whose fs holds a package.json at each dir in
 * `projectDirs`, which is what makes resolveProjectDirSafe find a project.
 */
export function makeCtx(projectDirs: string[] = []): CommandContext {
  const fs = makeMemoryFs();
  for (const dir of projectDirs) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(`${dir}/package.json`, '{"name":"flows-project"}');
  }
  return {
    configDir: "/mock/config",
    apiBaseUrl: "https://app.qawolf.com",
    outputMode: "human",
    isInteractive: false,
    signals: noopSignals,
    fs,
    log: () => ({ ...makeNoopLogger(), debug: debugMock }),
    ui: { ...makeFakeUI("human"), info: uiInfoMock, warn: uiWarnMock },
  } as unknown as CommandContext;
}

/** Call from a beforeEach: clears every mock, then re-arms the defaults. */
export function resetStagedRunMocks(): void {
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
}
