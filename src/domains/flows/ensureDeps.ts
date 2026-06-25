import type { Fs } from "~/shell/fs.js";
import { dirname, join } from "node:path";
import { flowsMessages } from "~/core/messages/index.js";

// Walk up from a flow file to find its containing package root (the directory
// with the package.json that declares its dependencies).
export function findEnvDir(flowPath: string, fs: Fs): string | undefined {
  let dir = dirname(flowPath);
  while (true) {
    if (fs.existsSync(join(dir, "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

// Returns the single envDir for all flow files, or undefined if none have a
// package.json ancestor. Throws if files span multiple packages.
export function resolveUniqueEnvDir(
  files: string[],
  fs: Fs,
): string | undefined {
  const dirs = new Set(
    files
      .map((f) => findEnvDir(f, fs))
      .filter((d): d is string => d !== undefined),
  );
  if (dirs.size > 1) {
    const listed = [...dirs].map((d) => `  - ${d}`).join("\n");
    throw new Error(
      flowsMessages.ensureDeps.multiPackagePattern(dirs.size, listed),
    );
  }
  return dirs.size === 1 ? [...dirs][0] : undefined;
}

/**
 * resolveUniqueEnvDir, but swallows the multi-package error and returns
 * undefined so callers fall back to the managed runtime dir instead of failing.
 */
export function resolveProjectDirSafe(
  files: string[],
  fs: Fs,
): string | undefined {
  try {
    return resolveUniqueEnvDir(files, fs);
  } catch {
    return undefined;
  }
}
