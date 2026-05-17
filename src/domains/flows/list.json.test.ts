import { afterEach, describe, expect, it, mock } from "bun:test";

import type { CommandContext } from "~/shell/commandContext.js";
import type { OutputMode } from "~/shell/ui/env.js";

import { type FlowsListDeps, flowsList } from "./list.js";
import { makeFakeUI } from "~/domains/runner/run.fixtures.js";

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

describe("flowsList json mode output", () => {
  it("emits a JSON array with file, name, tags, target, browser per item", async () => {
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

    await flowsList(makeCtx(ui, "json"), undefined, deps);

    expect(ui.json).toHaveBeenCalledWith([
      {
        file: "src/flows/login.flow.ts",
        name: "Login",
        tags: [],
        target: "Web - Chrome",
        browser: "chromium",
      },
    ]);
    // Ticket acceptance: the emitted payload survives JSON round-trip.
    const captured: unknown = (ui.json as ReturnType<typeof mock>).mock
      .calls[0]?.[0];
    expect(JSON.parse(JSON.stringify(captured))).toEqual(captured);
    expect(ui.intro).not.toHaveBeenCalled();
    expect(ui.outro).not.toHaveBeenCalled();
  });

  it("falls back to basename for name when meta.name is undefined", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/proj/src/flows/checkout.flow.ts"],
      metaByFile: {
        "/proj/src/flows/checkout.flow.ts": { target: "Web - Firefox" },
      },
    });

    await flowsList(makeCtx(ui, "json"), undefined, deps);

    expect(ui.json).toHaveBeenCalledWith([
      {
        file: "src/flows/checkout.flow.ts",
        name: "checkout",
        tags: [],
        target: "Web - Firefox",
        browser: "firefox",
      },
    ]);
  });

  it("strips the .flow.js extension when falling back to basename", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/proj/src/flows/legacy.flow.js"],
      metaByFile: {
        "/proj/src/flows/legacy.flow.js": { target: "Web - Chrome" },
      },
    });

    await flowsList(makeCtx(ui, "json"), undefined, deps);

    expect(ui.json).toHaveBeenCalledWith([
      {
        file: "src/flows/legacy.flow.js",
        name: "legacy",
        tags: [],
        target: "Web - Chrome",
        browser: "chromium",
      },
    ]);
  });

  it("leaves browser undefined for an unrecognized target (e.g. Android - Pixel)", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/proj/src/flows/mobile.flow.ts"],
      metaByFile: {
        "/proj/src/flows/mobile.flow.ts": {
          name: "Mobile",
          target: "Android - Pixel",
        },
      },
    });

    await flowsList(makeCtx(ui, "json"), undefined, deps);

    expect(ui.json).toHaveBeenCalledWith([
      {
        file: "src/flows/mobile.flow.ts",
        name: "Mobile",
        tags: [],
        target: "Android - Pixel",
        browser: undefined,
      },
    ]);
  });
});
