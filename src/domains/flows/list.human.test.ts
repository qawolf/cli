import { afterEach, describe, expect, it, mock } from "bun:test";

import type { CommandContext } from "~/shell/commandContext.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import type { OutputMode } from "~/shell/ui/env.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { type FlowsListDeps, flowsList } from "./list.js";
import { callsOf, makeFakeUI } from "~/shell/commandContext.testUtils.js";

const noopSignals = makeNoopSignals();

afterEach(() => {
  mock.restore();
});

const fakeCwd = "/proj";

function makeCtx(
  ui = makeFakeUI(),
  outputMode: OutputMode = "human",
): CommandContext {
  return {
    ui: { ...ui, mode: outputMode },
    configDir: "/tmp/test-config",
    outputMode,
    isInteractive: false,
    apiBaseUrl: "https://example.invalid",
    signals: noopSignals,
    log: () => makeNoopLogger(),
    fs: makeMemoryFs(),
  };
}

function makeDeps(overrides?: {
  files?: readonly string[];
  metaByFile?: Record<string, { name?: string; target?: string }>;
}): FlowsListDeps {
  const { files = [], metaByFile = {} } = overrides ?? {};
  return {
    cwd: fakeCwd,
    expandPatterns: mock<FlowsListDeps["expandPatterns"]>(() =>
      Promise.resolve([...files]),
    ),
    peekFlowMeta: mock<FlowsListDeps["peekFlowMeta"]>((file: string) =>
      Promise.resolve({
        name: metaByFile[file]?.name,
        target: metaByFile[file]?.target,
      }),
    ),
    readCachedFlows: mock<FlowsListDeps["readCachedFlows"]>(() =>
      Promise.resolve(new Map()),
    ),
    readEnvLabel: mock<FlowsListDeps["readEnvLabel"]>((dir: string) =>
      Promise.resolve(dir),
    ),
    findPulledEnv: mock<FlowsListDeps["findPulledEnv"]>(() =>
      Promise.resolve(undefined),
    ),
    listPulledEnvDirs: mock<FlowsListDeps["listPulledEnvDirs"]>(() =>
      Promise.resolve([]),
    ),
  };
}

describe("flowsList human mode on a narrow terminal", () => {
  it("prints a card per flow instead of a table that would not fit", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/proj/src/flows/login.flow.ts"],
      metaByFile: {
        "/proj/src/flows/login.flow.ts": {
          name: "Login",
          target: "Web - Chrome",
        },
      },
    });

    await flowsList(
      { ...makeCtx(ui, "human"), isInteractive: true },
      undefined,
      deps,
      { tags: [] },
      { columns: 20 },
    );

    const output = callsOf(ui.write)
      .map((c) => String(c[0]))
      .join("");
    // oxlint-disable-next-line no-control-regex
    const plainOutput = output.replace(/\x1b\[[\d;]*m/g, "");
    expect(plainOutput).not.toMatch(/^name\s+target/m);
    expect(plainOutput).toMatch(/^Login {2}· {2}Web - Chrome$/m);
    expect(plainOutput).toMatch(/^ {2}file\s+src/m);
    expect(ui.intro).toHaveBeenCalledWith("Flows");
    expect(ui.outro).toHaveBeenCalledWith("1 flow");
  });
});
