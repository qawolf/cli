import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import type { CommandContext } from "~/shell/commandContext.js";

import { type FlowsListDeps, flowsList } from "./list.js";
import { makeFakeUI } from "~/domains/runner/run.fixtures.js";

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
    const stdoutWrite = spyOn(process.stdout, "write").mockImplementation(
      () => true,
    );
    const stderrWrite = spyOn(process.stderr, "write").mockImplementation(
      () => true,
    );

    await flowsList(makeAgentCtx(ui), undefined, deps);

    const stderr = stderrWrite.mock.calls.map((c) => String(c[0])).join("");
    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(stderr).toContain("Login");
    expect(stderr).toContain("Web - Chrome");
    expect(stderr).toContain("src/flows/login.flow.ts");
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
    spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderrWrite = spyOn(process.stderr, "write").mockImplementation(
      () => true,
    );

    await flowsList(makeAgentCtx(ui), undefined, deps);

    const stderr = stderrWrite.mock.calls.map((c) => String(c[0])).join("");
    expect(stderr).not.toContain("\x1b[1m");
    expect(stderr).not.toContain("\x1b[0m");
  });
});
