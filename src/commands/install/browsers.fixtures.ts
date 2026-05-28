import { mock } from "bun:test";

import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";
import { makeCtx, makeFakeUI } from "~/shell/commandContext.testUtils.js";

import type { InstallBrowsersDeps } from "~/domains/install/browsers.js";

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

export { makeCtx, makeFakeUI };

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
  const ctx = makeCtx();
  const deps = makeDeps({
    files: ["/a"],
    metaByFile: { "/a": { target } },
    ...overrides,
  });
  return { ui: ctx.ui, deps, ctx };
}

export const callsOf = (s: SpawnFn) =>
  (s as ReturnType<typeof mock>).mock.calls;
