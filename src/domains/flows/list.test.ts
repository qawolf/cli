import { afterEach, describe, expect, it, mock } from "bun:test";

import type { CommandContext } from "~/shell/commandContext.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import type { OutputMode } from "~/shell/ui/env.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";

import { type FlowsListDeps, flowsList } from "./list.js";
import { callsOf, makeFakeUI } from "~/domains/runner/run.fixtures.js";

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

describe("flowsList pattern forwarding", () => {
  it("forwards undefined pattern as empty array to expandPatterns", async () => {
    const deps = makeDeps({ files: [] });

    await flowsList(makeCtx(), undefined, deps);

    expect(deps.expandPatterns).toHaveBeenCalledWith([], fakeCwd);
  });

  it("forwards a string pattern as a single-element array to expandPatterns", async () => {
    const deps = makeDeps({ files: [] });

    await flowsList(makeCtx(), "src/auth/*.flow.ts", deps);

    expect(deps.expandPatterns).toHaveBeenCalledWith(
      ["src/auth/*.flow.ts"],
      fakeCwd,
    );
  });
});

describe("flowsList empty match", () => {
  it("prints 'No flows matched.' via info and exits 0 in human mode", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({ files: [] });

    const result = await flowsList(makeCtx(ui, "human"), undefined, deps);

    expect(result).toBeUndefined();
    expect(ui.info).toHaveBeenCalledWith("No flows matched.");
    expect(ui.json).not.toHaveBeenCalled();
  });

  it("emits an empty JSON array and skips info in json mode", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({ files: [] });

    const result = await flowsList(makeCtx(ui, "json"), undefined, deps);

    expect(result).toBeUndefined();
    expect(ui.json).toHaveBeenCalledWith([]);
    expect(ui.info).not.toHaveBeenCalled();
  });
});

describe("flowsList human mode table", () => {
  const stripAnsi = (s: string | undefined): string =>
    // oxlint-disable-next-line no-control-regex
    (s ?? "").replace(/\x1b\[[\d;]*m/g, "");
  it("writes a bolded header + name|target|file rows; frames with intro/outro", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: [
        "/proj/src/flows/login.flow.ts",
        "/proj/src/flows/sub/checkout.flow.ts",
      ],
      metaByFile: {
        "/proj/src/flows/login.flow.ts": {
          name: "Login",
          target: "Web - Chrome",
        },
        "/proj/src/flows/sub/checkout.flow.ts": {
          name: "Checkout",
          target: "Web - Firefox",
        },
      },
    });

    await flowsList(makeCtx(ui, "human"), undefined, deps);

    const output = callsOf(ui.write)
      .map((c) => String(c[0]))
      .join("");
    const lines = output.split("\n").filter((l) => l.length > 0);

    // Header is bold — ESC[1m wraps the content, ESC[0m resets it.
    expect(lines[0]).toMatch(/\[1m/);
    expect(lines[0]).toMatch(/\[0m/);
    // Column order: strip all ANSI codes (including bare ESC) before asserting.
    // oxlint-disable-next-line no-control-regex, @typescript-eslint/no-non-null-assertion
    expect(lines[0]!.replace(/\x1b[^m]*m/g, "")).toMatch(
      /^name\s+target\s+file$/,
    );
    expect(stripAnsi(lines[1])).toMatch(
      /^Login\s+Web - Chrome\s+src\/flows\/login\.flow\.ts$/,
    );
    expect(stripAnsi(lines[2])).toMatch(
      /^Checkout\s+Web - Firefox\s+src\/flows\/sub\/checkout\.flow\.ts$/,
    );
    expect(ui.intro).toHaveBeenCalledWith("Flows");
    expect(ui.outro).toHaveBeenCalledWith("2 flows");
    expect(ui.json).not.toHaveBeenCalled();
  });

  it("renders an empty target cell with file still at the end", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/proj/src/flows/untargeted.flow.ts"],
      metaByFile: {
        "/proj/src/flows/untargeted.flow.ts": { name: "Untargeted" },
      },
    });

    await flowsList(makeCtx(ui, "human"), undefined, deps);

    const output = callsOf(ui.write)
      .map((c) => String(c[0]))
      .join("");
    const lines = output.split("\n").filter((l) => l.length > 0);

    expect(stripAnsi(lines[1])).toMatch(
      /^Untargeted\s+src\/flows\/untargeted\.flow\.ts$/,
    );
  });
});
