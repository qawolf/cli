import { type Fs, makeDefaultFs } from "~/shell/fs.js";

import { type EnsureRuntimeEnvArgs } from "./ensureRuntimeEnv.js";
import { managedEnvDir } from "./managedEnvDir.js";
import { allPinnedResolved } from "./resolvePinned.js";

export type ResolveDepsRootArgs = EnsureRuntimeEnvArgs;

/**
 * Returns the first directory whose pinned deps already resolve (override →
 * project → managed), or undefined if none are installed. Never installs —
 * use for read-only diagnostics like `doctor`.
 */
export function resolveDepsRootIfPresent(
  args: ResolveDepsRootArgs,
  fs: Fs = makeDefaultFs(),
): string | undefined {
  if (args.overrideDir !== undefined && allPinnedResolved(args.overrideDir, fs))
    return args.overrideDir;
  if (args.projectDir !== undefined && allPinnedResolved(args.projectDir, fs))
    return args.projectDir;
  const managed = managedEnvDir();
  if (allPinnedResolved(managed, fs)) return managed;
  return undefined;
}
