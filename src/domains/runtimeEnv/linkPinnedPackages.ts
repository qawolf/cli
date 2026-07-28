import { dirname, join } from "node:path";

import { type Fs } from "~/shell/fs.js";

import { pinnedPackages } from "./pinnedPackages.js";
import { createDirSymlink } from "./symlinkDir.js";

export type LinkPinnedPackagesArgs = {
  depsRoot: string;
  nodeModulesDir: string;
  fs: Fs;
};

/**
 * Links each pinned package from the managed runtime (`depsRoot/node_modules`)
 * into `nodeModulesDir`, replacing any existing entry so the managed copy
 * always wins (prefer-pinned). Both hops link the same realpath, so every
 * consumer resolves a single instance of each executor package.
 */
export async function linkPinnedPackages(
  args: LinkPinnedPackagesArgs,
): Promise<void> {
  const { depsRoot, nodeModulesDir, fs } = args;
  const managedModules = join(depsRoot, "node_modules");

  await fs.mkdir(nodeModulesDir, { recursive: true });
  for (const { name } of pinnedPackages) {
    const segments = name.split("/");
    const target = join(nodeModulesDir, ...segments);
    if (segments.length > 1) {
      await fs.mkdir(dirname(target), { recursive: true });
    }
    await fs.rm(target, { recursive: true, force: true });
    await createDirSymlink(join(managedModules, ...segments), target);
  }
}
