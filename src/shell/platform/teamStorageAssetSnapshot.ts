import { randomBytes } from "node:crypto";
import { join, sep } from "node:path";

import { errorMessage } from "~/core/errors.js";
import type { Fs } from "~/shell/fs.js";

export function mintAssetSnapshotPath(
  assetsAbs: string,
  label: string,
): string {
  return `${assetsAbs}.${label}-${randomBytes(8).toString("hex")}`;
}

export async function replaceAssetsDir(
  assetsAbs: string,
  tmpAssets: string,
  fs: Fs,
): Promise<void> {
  const oldAssets = mintAssetSnapshotPath(assetsAbs, "old");
  let movedOldAssets = false;

  try {
    if (await fs.pathExists(assetsAbs)) {
      await fs.rename(assetsAbs, oldAssets);
      movedOldAssets = true;
    }
    await fs.rename(tmpAssets, assetsAbs);
  } catch (error: unknown) {
    if (movedOldAssets) {
      try {
        await fs.rename(oldAssets, assetsAbs);
      } catch (rollbackError: unknown) {
        throw new Error(
          `Failed to replace team-storage assets and rollback also failed; previous assets may remain at ${oldAssets}. Replace error: ${errorMessage(error)}. Rollback error: ${errorMessage(rollbackError)}`,
          { cause: rollbackError },
        );
      }
    }
    throw error;
  }

  if (movedOldAssets) {
    await cleanupAssetSnapshot(oldAssets, fs);
  }
}

export async function cleanupAssetSnapshot(
  absPath: string,
  fs: Fs,
): Promise<void> {
  await fs.rm(absPath, { recursive: true, force: true }).catch(() => {});
}

export async function hasExactAssetSnapshot(
  assetsAbs: string,
  filePaths: readonly string[],
  fs: Fs,
): Promise<boolean> {
  const expected = expectedEntries(filePaths);
  if (!(await fs.pathExists(assetsAbs))) return expected.size === 0;

  const actual = new Set<string>();
  await collectEntries(assetsAbs, "", actual, fs);
  return setsEqual(actual, expected);
}

function expectedEntries(filePaths: readonly string[]): Set<string> {
  const entries = new Set<string>();
  for (const filePath of filePaths) {
    entries.add(filePath);
    const segments = filePath.split(sep);
    for (let i = 1; i < segments.length; i++) {
      entries.add(segments.slice(0, i).join(sep));
    }
  }
  return entries;
}

async function collectEntries(
  root: string,
  relDir: string,
  out: Set<string>,
  fs: Fs,
): Promise<void> {
  const current = relDir ? join(root, relDir) : root;
  for (const entry of await fs.readdirWithTypes(current)) {
    const relPath = relDir ? join(relDir, entry.name) : entry.name;
    out.add(relPath);
    if (entry.isDirectory()) {
      await collectEntries(root, relPath, out, fs);
    }
  }
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}
