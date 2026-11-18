import { join } from "node:path";
import { describe, expect, it, mock } from "bun:test";

import type { CommandContext } from "~/shell/commandContext.js";
import { makeFakeUI } from "~/shell/commandContext.testUtils.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";

import { type FlowsListDeps, flowsList } from "./list.js";

const loginPath = "/proj/src/flows/login.flow.ts";

function makeDeps(
  meta: Awaited<ReturnType<FlowsListDeps["peekFlowMeta"]>>,
): FlowsListDeps {
  return {
    cwd: "/proj",
    expandPatterns: mock(() => Promise.resolve([loginPath])),
    findPulledEnv: mock(() => Promise.resolve(undefined)),
    listPulledEnvDirs: mock(() => Promise.resolve([])),
    peekFlowMeta: mock(() => Promise.resolve(meta)),
    readCachedTags: mock(() => Promise.resolve(new Map())),
    readEnvLabel: mock((dir: string) => Promise.resolve(dir)),
  };
}

describe("flowsList of a file that lists several targets", () => {
  it("lists one item per target, named as the platform names its flows", async () => {
    const ui = makeFakeUI();
    const ctx: CommandContext = {
      apiBaseUrl: "https://example.invalid",
      configDir: "/tmp/test-config",
      fs: makeMemoryFs(),
      isInteractive: false,
      log: () => makeNoopLogger(),
      outputMode: "json",
      signals: makeNoopSignals(),
      ui: { ...ui, mode: "json" },
    };

    await flowsList(
      ctx,
      undefined,
      makeDeps({
        name: "Login",
        target: undefined,
        targets: ["macOS - Any Mac (Latest)", "Windows 11 - Desktop"],
      }),
    );

    expect(ui.json).toHaveBeenCalledWith([
      {
        browser: undefined,
        env: undefined,
        file: join("src", "flows", "login.flow.ts"),
        name: "Login · macOS - Any Mac (Latest)",
        tags: undefined,
        target: "macOS - Any Mac (Latest)",
      },
      {
        browser: undefined,
        env: undefined,
        file: join("src", "flows", "login.flow.ts"),
        name: "Login · Windows 11 - Desktop",
        tags: undefined,
        target: "Windows 11 - Desktop",
      },
    ]);
  });
});
