import { type Fs, makeDefaultFs } from "~/shell/fs.js";

import { managedEnvDir as defaultManagedEnvDir } from "./managedEnvDir.js";
import { installPinned, defaultSpawnInstall } from "./installPinned.js";
import { allPinnedResolved } from "./resolvePinned.js";

type RuntimeEnvSource = "override" | "project" | "managed";

export type EnsureRuntimeEnvResult = {
  depsRoot: string;
  source: RuntimeEnvSource;
  installed: boolean;
};

export type EnsureRuntimeEnvArgs = {
  projectDir?: string;
  overrideDir?: string;
};

type EnsureRuntimeEnvDeps = {
  fs: Fs;
  install: (targetDir: string) => Promise<void>;
  resolveManagedDir: () => string;
};

/**
 * Resolves a single directory (`depsRoot`) that callers use to resolve all
 * pinned runtime dependencies. Checks override → project → managed env in
 * order, installing the managed env on first use.
 */
export async function ensureRuntimeEnv(
  args: EnsureRuntimeEnvArgs,
  deps: Partial<EnsureRuntimeEnvDeps> = {},
): Promise<EnsureRuntimeEnvResult> {
  const fs = deps.fs ?? makeDefaultFs();
  const resolveManagedDir = deps.resolveManagedDir ?? defaultManagedEnvDir;
  const install =
    deps.install ??
    ((t) => installPinned(t, { fs, spawnInstall: defaultSpawnInstall }));

  if (args.overrideDir !== undefined) {
    if (allPinnedResolved(args.overrideDir, fs)) {
      return {
        depsRoot: args.overrideDir,
        source: "override",
        installed: false,
      };
    }
    throw new Error(
      `--deps directory ${args.overrideDir} is missing required pinned dependencies. ` +
        `Run 'npm install' in that directory or point to a valid managed env directory.`,
    );
  }

  if (args.projectDir !== undefined && allPinnedResolved(args.projectDir, fs)) {
    return { depsRoot: args.projectDir, source: "project", installed: false };
  }

  const managed = resolveManagedDir();
  if (allPinnedResolved(managed, fs)) {
    return { depsRoot: managed, source: "managed", installed: false };
  }

  await install(managed);
  return { depsRoot: managed, source: "managed", installed: true };
}
