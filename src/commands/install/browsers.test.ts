import { afterEach, describe, expect, it, mock } from "bun:test";

import type { SpawnFn, SpawnResult } from "~/doctor/types.js";
import type { CommandContext } from "~/lib/context.js";
import type { UI } from "~/lib/ui/index.js";

import { type InstallBrowsersDeps, installBrowsers } from "./browsers.js";

afterEach(() => {
  mock.restore();
});

const FAKE_NODE = "/fake/node";
const FAKE_CLI = "/fake/playwright/cli.js";

const ok: SpawnResult = { exitCode: 0, stdout: "", stderr: "" };
function spawnSequence(...results: SpawnResult[]): SpawnFn {
  if (!results.length)
    throw new Error("spawnSequence requires at least one result");
  let i = 0;
  return mock<SpawnFn>(() =>
    Promise.resolve(results[i++] ?? results[results.length - 1]!),
  );
}

function makeFakeUI(): UI {
  return {
    mode: "human",
    gap: mock(() => {}),
    intro: mock(() => {}),
    note: mock(() => {}),
    outro: mock(() => {}),
    confirm: mock(() => Promise.resolve({ ok: false } as const)),
    password: mock(() => Promise.resolve({ ok: false } as const)),
    withProgress: mock(() =>
      Promise.resolve([]),
    ) as unknown as UI["withProgress"],
    step: mock(() => {}),
    success: mock(() => {}),
    warn: mock(() => {}),
    cancel: mock(() => {}),
    json: mock(() => {}),
    output: mock(() => {}),
    error: mock(() => {}),
    info: mock(() => {}),
  };
}

const makeCtx = (ui: UI): CommandContext => ({
  ui,
  configDir: "/tmp/test-config",
  outputMode: "human",
  isInteractive: false,
  apiBaseUrl: "https://example.invalid",
});

type FakeMeta = { name?: string; target?: string };

type DepsOverrides = {
  files?: readonly string[];
  metaByFile?: Record<string, FakeMeta>;
  spawn?: SpawnFn;
  platform?: NodeJS.Platform;
};

function makeDeps(overrides: DepsOverrides): InstallBrowsersDeps {
  const files = overrides.files ?? [];
  const metaByFile = overrides.metaByFile ?? {};
  return {
    cwd: "/proj",
    spawn: overrides.spawn ?? spawnSequence(ok),
    platform: overrides.platform ?? "darwin",
    expandPatterns: mock<InstallBrowsersDeps["expandPatterns"]>(() =>
      Promise.resolve([...files]),
    ),
    peekFlowMeta: mock<InstallBrowsersDeps["peekFlowMeta"]>((file: string) =>
      Promise.resolve({
        name: metaByFile[file]?.name,
        target: metaByFile[file]?.target,
      }),
    ),
    execPath: FAKE_NODE,
    playwrightCliPath: FAKE_CLI,
  };
}

function setup(
  target: string,
  overrides: Omit<DepsOverrides, "files" | "metaByFile"> = {},
) {
  const ui = makeFakeUI();
  const deps = makeDeps({
    files: ["/a"],
    metaByFile: { "/a": { target } },
    ...overrides,
  });
  return { ui, deps, ctx: makeCtx(ui) };
}
const callsOf = (s: SpawnFn) => (s as ReturnType<typeof mock>).mock.calls;
describe("installBrowsers", () => {
  it("spawns playwright cli with install <browser> on darwin (no --with-deps)", async () => {
    const { ui, deps, ctx } = setup("chromium");

    const result = await installBrowsers(ctx, undefined, deps);

    expect(result).toBeUndefined();
    expect(deps.spawn).toHaveBeenCalledTimes(1);
    expect(deps.spawn).toHaveBeenCalledWith(FAKE_NODE, [
      FAKE_CLI,
      "install",
      "chromium",
    ]);
    expect(ui.info).toHaveBeenCalledWith("Installing chromium...");
    expect(ui.success).toHaveBeenCalledWith("Installed 1 browser.");
  });

  it("spawns install for each unique browser sorted alphabetically", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/a", "/b", "/c"],
      metaByFile: {
        "/a": { target: "firefox" },
        "/b": { target: "webkit" },
        "/c": { target: "chromium" },
      },
      spawn: spawnSequence(ok, ok, ok),
    });

    await installBrowsers(makeCtx(ui), undefined, deps);

    expect(callsOf(deps.spawn)).toEqual([
      [FAKE_NODE, [FAKE_CLI, "install", "chromium"]],
      [FAKE_NODE, [FAKE_CLI, "install", "firefox"]],
      [FAKE_NODE, [FAKE_CLI, "install", "webkit"]],
    ]);
    expect(ui.success).toHaveBeenCalledWith("Installed 3 browsers.");
  });

  it("invokes each browser only once when multiple flows share a target", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/a", "/b", "/c"],
      metaByFile: {
        "/a": { target: "chromium" },
        "/b": { target: "chromium" },
        "/c": { target: "chromium" },
      },
    });

    await installBrowsers(makeCtx(ui), undefined, deps);

    expect(deps.spawn).toHaveBeenCalledTimes(1);
    expect(ui.success).toHaveBeenCalledWith("Installed 1 browser.");
  });

  it("silently skips flows whose target is not a known browser", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/a", "/b"],
      metaByFile: {
        "/a": { target: "Web - Chrome" },
        "/b": { target: "android" },
      },
    });

    await installBrowsers(makeCtx(ui), undefined, deps);

    expect(deps.spawn).not.toHaveBeenCalled();
    expect(ui.info).toHaveBeenCalledWith(
      "No web flows requiring browser installation were found.",
    );
    expect(ui.success).not.toHaveBeenCalled();
  });

  it("reports no flows when expandPatterns returns empty", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({ files: [] });

    await installBrowsers(makeCtx(ui), undefined, deps);

    expect(deps.peekFlowMeta).not.toHaveBeenCalled();
    expect(deps.spawn).not.toHaveBeenCalled();
    expect(ui.info).toHaveBeenCalledWith(
      "No web flows requiring browser installation were found.",
    );
  });

  it("passes --with-deps before the browser name on Linux", async () => {
    const { deps, ctx } = setup("chromium", { platform: "linux" });

    await installBrowsers(ctx, undefined, deps);

    expect(deps.spawn).toHaveBeenCalledWith(FAKE_NODE, [
      FAKE_CLI,
      "install",
      "--with-deps",
      "chromium",
    ]);
  });

  it("returns error and stops on first non-zero exit", async () => {
    const ui = makeFakeUI();
    const deps = makeDeps({
      files: ["/a", "/b"],
      metaByFile: {
        "/a": { target: "chromium" },
        "/b": { target: "firefox" },
      },
      spawn: spawnSequence(ok, {
        exitCode: 1,
        stdout: "",
        stderr: "boom\nmore lines\n",
      }),
    });

    const result = await installBrowsers(makeCtx(ui), undefined, deps);

    expect(callsOf(deps.spawn).length).toBe(2);
    expect(result).toEqual({
      error: "playwright install firefox failed: boom",
    });
    expect(ui.success).not.toHaveBeenCalled();
  });

  it("returns error when spawn returns exitCode -1 (process failed to launch)", async () => {
    const { deps, ctx, ui } = setup("chromium", {
      spawn: spawnSequence({ exitCode: -1, stdout: "", stderr: "" }),
    });

    const result = await installBrowsers(ctx, undefined, deps);

    expect(result).toEqual({
      error: "playwright install chromium failed: process failed to launch",
    });
    expect(ui.success).not.toHaveBeenCalled();
  });

  it("forwards the pattern argument to expandPatterns (string → single-element array; undefined → empty array)", async () => {
    const a = setup("chromium");
    await installBrowsers(a.ctx, "flows/login.flow.ts", a.deps);
    expect(a.deps.expandPatterns).toHaveBeenCalledWith(
      ["flows/login.flow.ts"],
      "/proj",
    );
    const b = setup("chromium");
    await installBrowsers(b.ctx, undefined, b.deps);
    expect(b.deps.expandPatterns).toHaveBeenCalledWith([], "/proj");
  });
});
