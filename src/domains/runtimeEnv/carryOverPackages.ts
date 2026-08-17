import { lstat } from "node:fs/promises";
import { dirname, join } from "node:path";

import { type Fs } from "~/shell/fs.js";

import { planCarryOver } from "./carryOverPlan.js";
import { createDirSymlink } from "./symlinkDir.js";

export type CarryOverPackagesArgs = {
  projectModulesDir: string;
  // The outer hop, already populated by the fallback install.
  nodeModulesDir: string;
  fs: Fs;
};

/**
 * Links every package the project physically has but the fallback install did
 * not provide into the outer hop, and returns their names. Only the project's
 * own node_modules is read — an ancestor tree may belong to an unrelated repo,
 * which is why the walk refuses to symlink one wholesale.
 */
export async function carryOverPackages(
  args: CarryOverPackagesArgs,
): Promise<string[]> {
  const { projectModulesDir, nodeModulesDir, fs } = args;

  const present = await listPackageNames(projectModulesDir, fs);
  if (present.length === 0) return [];

  const names = planCarryOver({
    present,
    installed: await listPackageNames(nodeModulesDir, fs),
  });
  const linked: string[] = [];
  for (const name of names) {
    const segments = name.split("/");
    const target = join(nodeModulesDir, ...segments);
    // An entry can occupy the path while reading as absent — a broken pinned
    // link, or an interrupted install. Leave it; a best-effort carry-over must
    // never overwrite the outer hop, nor fail the run.
    if (await pathOccupied(target)) continue;
    if (segments.length > 1)
      await fs.mkdir(dirname(target), { recursive: true });
    await createDirSymlink(join(projectModulesDir, ...segments), target);
    linked.push(name);
  }
  return linked;
}

/** True when anything sits at `path`, a broken symlink included. */
async function pathOccupied(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Package names directly under a node_modules dir, scopes expanded to
 * `@scope/name`. Entries without a package.json are not packages and are
 * skipped; a missing dir yields no names.
 */
async function listPackageNames(dir: string, fs: Fs): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const names: string[] = [];
  for (const entry of entries) {
    if (!entry.startsWith("@")) {
      if (fs.existsSync(join(dir, entry, "package.json"))) names.push(entry);
      continue;
    }
    let scoped: string[];
    try {
      scoped = await fs.readdir(join(dir, entry));
    } catch {
      continue;
    }
    for (const inner of scoped) {
      if (fs.existsSync(join(dir, entry, inner, "package.json"))) {
        names.push(`${entry}/${inner}`);
      }
    }
  }
  return names;
}
