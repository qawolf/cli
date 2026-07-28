import { join } from "node:path";

import { type Fs } from "~/shell/fs.js";

import { linkPinnedPackages } from "./linkPinnedPackages.js";

export type PopulateInnerHopArgs = {
  depsRoot: string;
  execDir: string;
  fs: Fs;
};

/**
 * Builds the inner hop (`execDir/node_modules`) as a real directory holding one
 * symlink per pinned package into the managed runtime. Exposing only the pinned
 * names — not the managed runtime's fully-hoisted transitive closure — keeps the
 * executor authoritative for its pinned packages while letting a flow's own
 * `import <dep>` miss the inner hop and fall through to the outer hop's project
 * version. The executor still resolves its pinned transitive deps because Node
 * walks each package's realpath inside the managed tree, where they stay hoisted.
 */
export async function populateInnerHop(
  args: PopulateInnerHopArgs,
): Promise<void> {
  const { depsRoot, execDir, fs } = args;
  await linkPinnedPackages({
    depsRoot,
    nodeModulesDir: join(execDir, "node_modules"),
    fs,
  });
}
