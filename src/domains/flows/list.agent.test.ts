import { join } from "node:path";
import { afterEach, describe, expect, it, mock } from "bun:test";

import type { CommandContext } from "~/shell/commandContext.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { type FlowsListDeps, flowsList } from "./list.js";
import { callsOf, makeFakeUI } from "~/shell/commandContext.testUtils.js";

const noopSignals = makeNoopSignals();

afterEach(() => {
  mock.restore();
});

const fakeCwd = "/proj";

function makeAgentCtx(ui = makeFakeUI()): CommandContext {
  return {
    ui: { ...ui, mode: "agent" },
    configDir: "/tmp/test-config",
    outputMode: "agent",
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
    readCachedTags: mock<FlowsListDeps["readCachedTags"]>(() =>
      Promise.resolve(new Map<string, readonly string[]>()),
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

describe("flowsList agent mode", () => {
  it("writes the table to stderr (not stdout) and skips intro/outro/json", async () => {
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

    await flowsList(makeAgentCtx(ui), undefined, deps);

    const output = callsOf(ui.write)
      .map((c) => String(c[0]))
      .join("");
    expect(output).toContain("Login");
    expect(output).toContain("Web - Chrome");
    expect(output).toContain(join("src", "flows", "login.flow.ts"));
    expect(ui.intro).not.toHaveBeenCalled();
    expect(ui.outro).not.toHaveBeenCalled();
    expect(ui.json).not.toHaveBeenCalled();
  });

  it("emits no ANSI bold escapes in agent stderr output", async () => {
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

    await flowsList(makeAgentCtx(ui), undefined, deps);

    const output = callsOf(ui.write)
      .map((c) => String(c[0]))
      .join("");
    expect(output).not.toContain("\x1b[1m");
    expect(output).not.toContain("\x1b[0m");
  });
});
