import { runnerMessages } from "~/core/messages/runner.js";
import { type Fs, makeDefaultFs } from "~/shell/fs.js";

import { managedEnvDir as defaultManagedEnvDir } from "./managedEnvDir.js";
import { installPinned, defaultSpawnInstall } from "./installPinned.js";
import {
  allPinnedResolved,
  describePinnedFailure,
  pinnedResolutionFailures,
} from "./resolvePinned.js";

type RuntimeEnvSource = "override" | "project" | "managed";

export type EnsureRuntimeEnvResult = {
  depsRoot: string;
  source: RuntimeEnvSource;
  installed: boolean;
};

export type EnsureRuntimeEnvArgs = {
  platform: NodeJS.Platform;
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
    ((t) =>
      installPinned(t, {
        fs,
        spawnInstall: defaultSpawnInstall,
        platform: args.platform,
      }));

  if (args.overrideDir !== undefined) {
    const failures = pinnedResolutionFailures(
      args.overrideDir,
      fs,
      args.platform,
    );
    if (failures.length === 0) {
      return {
        depsRoot: args.overrideDir,
        source: "override",
        installed: false,
      };
    }
    throw new Error(
      runnerMessages.depsDirIncomplete(
        args.overrideDir,
        failures.map(describePinnedFailure),
      ),
    );
  }

  if (
    args.projectDir !== undefined &&
    allPinnedResolved(args.projectDir, fs, args.platform)
  ) {
    return { depsRoot: args.projectDir, source: "project", installed: false };
  }

  const managed = resolveManagedDir();
  if (allPinnedResolved(managed, fs, args.platform)) {
    return { depsRoot: managed, source: "managed", installed: false };
  }

  await install(managed);
  if (!allPinnedResolved(managed, fs, args.platform)) {
    throw new Error(
      `Managed runtime is incomplete after install at ${managed}.`,
    );
  }
  return { depsRoot: managed, source: "managed", installed: true };
}
