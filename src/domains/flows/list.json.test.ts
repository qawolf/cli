import { join } from "node:path";
import { afterEach, describe, expect, it, mock } from "bun:test";

import type { CommandContext } from "~/shell/commandContext.js";
import { makeNoopSignals } from "~/shell/signals/createSignalRegistry.fixtures.js";
import type { OutputMode } from "~/shell/ui/env.js";
import { makeNoopLogger } from "~/shell/logger.testUtils.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { type FlowsListDeps, flowsList } from "./list.js";
import { makeFakeUI } from "~/shell/commandContext.testUtils.js";

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
  cachedTags?: Record<string, readonly string[]>;
}): FlowsListDeps {
  const { files = [], metaByFile = {}, cachedTags = {} } = overrides ?? {};
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
      Promise.resolve(new Map(Object.entries(cachedTags))),
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
        file: join("src", "flows", "login.flow.ts"),
        name: "Login",
        tags: undefined,
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
        file: join("src", "flows", "checkout.flow.ts"),
        name: "checkout",
        tags: undefined,
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
        file: join("src", "flows", "legacy.flow.js"),
        name: "legacy",
        tags: undefined,
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
        file: join("src", "flows", "mobile.flow.ts"),
        name: "Mobile",
        tags: undefined,
        target: "Android - Pixel",
        browser: undefined,
      },
    ]);
  });
  // A pulled flow known to carry no tags is not the same as a flow whose tags
  // the CLI never fetched: one sends [], the other sends nothing.
  it("emits an empty tag list for a pulled flow with no tags", async () => {
    const ui = makeFakeUI();
    const file = "/proj/.qawolf/staging/src/flows/login.flow.ts";
    const deps = makeDeps({
      files: [file],
      metaByFile: { [file]: { name: "Login", target: "Web - Chrome" } },
      cachedTags: { [file]: [] },
    });

    await flowsList(makeCtx(ui, "json"), undefined, deps);

    const items = (ui.json as ReturnType<typeof mock>).mock.calls[0]?.[0] as {
      tags?: readonly string[];
    }[];
    expect(items[0]?.tags).toEqual([]);
  });

  it("emits the cached tags for a pulled flow that has them", async () => {
    const ui = makeFakeUI();
    const file = "/proj/.qawolf/staging/src/flows/login.flow.ts";
    const deps = makeDeps({
      files: [file],
      metaByFile: { [file]: { name: "Login", target: "Web - Chrome" } },
      cachedTags: { [file]: ["auth", "smoke"] },
    });

    await flowsList(makeCtx(ui, "json"), undefined, deps);

    const items = (ui.json as ReturnType<typeof mock>).mock.calls[0]?.[0] as {
      tags?: readonly string[];
    }[];
    expect(items[0]?.tags).toEqual(["auth", "smoke"]);
  });

  it("omits tags entirely for a flow that was never pulled", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/proj/src/flows/local.flow.ts"],
      metaByFile: {
        "/proj/src/flows/local.flow.ts": {
          name: "Local",
          target: "Web - Chrome",
        },
      },
    });

    await flowsList(makeCtx(ui, "json"), undefined, deps);

    const items = (ui.json as ReturnType<typeof mock>).mock
      .calls[0]?.[0] as Record<string, unknown>[];
    expect(items[0]).not.toHaveProperty("tags", []);
    expect(items[0]?.["tags"]).toBeUndefined();
  });
});
