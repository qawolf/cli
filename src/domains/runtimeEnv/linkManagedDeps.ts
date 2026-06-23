import { type Stats } from "node:fs";
import { lstat, readlink, symlink } from "node:fs/promises";
import { join } from "node:path";

import { makeDefaultFs, type Fs } from "~/shell/fs.js";

/**
 * Makes the managed runtime's `node_modules` resolvable from a flow bundle by
 * symlinking `<bundleRoot>/node_modules -> <depsRoot>/node_modules`. Idempotent
 * and safe: never clobbers a real `node_modules`, refreshes a stale symlink,
 * and no-ops when the bundle already resolves deps from its own dir
 * (`bundleRoot === depsRoot`).
 */
export async function linkManagedDeps(
  bundleRoot: string,
  depsRoot: string,
  fs: Fs = makeDefaultFs(),
): Promise<void> {
  if (bundleRoot === depsRoot) return;

  const target = join(bundleRoot, "node_modules");
  const source = join(depsRoot, "node_modules");

  const existing = await lstatOrUndefined(target);
  if (existing?.isSymbolicLink()) {
    const current = await readlink(target);
    if (current === source) return;
    await fs.rm(target, { recursive: true, force: true });
  } else if (existing !== undefined) {
    return;
  }

  // On Windows a "dir" symlink needs the "Create symbolic links" privilege
  // (admin / Developer Mode); a junction links directories without elevation.
  // The qawolf binary ships for Windows, so prefer junction there.
  const linkType = process.platform === "win32" ? "junction" : "dir";
  await symlink(source, target, linkType);
}

async function lstatOrUndefined(path: string): Promise<Stats | undefined> {
  try {
    return await lstat(path);
  } catch {
    return undefined;
  }
}
