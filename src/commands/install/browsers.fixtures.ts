import { mock } from "bun:test";

import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";
import type { CommandContext } from "~/lib/context.js";
import type { UI } from "~/lib/ui/index.js";

import type { InstallBrowsersDeps } from "./browsers.js";

export const fakeCli = "/fake/node_modules/.bin/playwright";

export const ok: SpawnResult = { exitCode: 0, stdout: "", stderr: "" };

export function spawnSequence(...results: SpawnResult[]): SpawnFn {
  if (!results.length)
    throw new Error("spawnSequence requires at least one result");
  let i = 0;
  return mock<SpawnFn>(() =>
    Promise.resolve(results[i++] ?? results[results.length - 1]!),
  );
}

export function makeFakeUI(): UI {
  return {
    mode: "human",
    gap: mock(() => {}),
    intro: mock(() => {}),
    note: mock(() => {}),
    outro: mock(() => {}),
    confirm: mock(() => Promise.resolve({ ok: false } as const)),
    password: mock(() => Promise.resolve({ ok: false } as const)),
    withProgress: mock(
      async (steps: { message: string; task: () => Promise<unknown> }[]) => {
        const results: unknown[] = [];
        for (const step of steps) {
          results.push(await step.task());
        }
        return results;
      },
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

export const makeCtx = (ui: UI): CommandContext => ({
  ui,
  configDir: "/tmp/test-config",
  outputMode: "human",
  isInteractive: false,
  apiBaseUrl: "https://example.invalid",
});

export type FakeMeta = { name?: string; target?: string };

export type DepsOverrides = {
  files?: readonly string[];
  metaByFile?: Record<string, FakeMeta>;
  spawn?: SpawnFn;
  platform?: NodeJS.Platform;
};

export function makeDeps(overrides: DepsOverrides): InstallBrowsersDeps {
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
    playwrightCliPath: fakeCli,
  };
}

export function setup(
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

export const callsOf = (s: SpawnFn) =>
  (s as ReturnType<typeof mock>).mock.calls;
