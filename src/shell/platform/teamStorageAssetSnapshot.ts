import { randomBytes } from "node:crypto";
import { join, sep } from "node:path";

import { pathExists, readdir, rename, rm } from "~/shell/fs.js";

export function mintAssetSnapshotPath(
  assetsAbs: string,
  label: string,
): string {
  return `${assetsAbs}.${label}-${randomBytes(8).toString("hex")}`;
}

export async function replaceAssetsDir(
  assetsAbs: string,
  tmpAssets: string,
): Promise<void> {
  const oldAssets = mintAssetSnapshotPath(assetsAbs, "old");
  let movedOldAssets = false;

  try {
    if (await pathExists(assetsAbs)) {
      await rename(assetsAbs, oldAssets);
      movedOldAssets = true;
    }
    await rename(tmpAssets, assetsAbs);
  } catch (error: unknown) {
    if (movedOldAssets) {
      await rename(oldAssets, assetsAbs).catch(() => {});
    }
    throw error;
  }

  if (movedOldAssets) {
    await cleanupAssetSnapshot(oldAssets);
  }
}

export async function cleanupAssetSnapshot(absPath: string): Promise<void> {
  await rm(absPath, { recursive: true, force: true }).catch(() => {});
}

export async function hasExactAssetSnapshot(
  assetsAbs: string,
  filePaths: readonly string[],
): Promise<boolean> {
  const expected = expectedEntries(filePaths);
  if (!(await pathExists(assetsAbs))) return expected.size === 0;

  const actual = new Set<string>();
  await collectEntries(assetsAbs, "", actual);
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
): Promise<void> {
  const current = relDir ? join(root, relDir) : root;
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const relPath = relDir ? join(relDir, entry.name) : entry.name;
    out.add(relPath);
    if (entry.isDirectory()) {
      await collectEntries(root, relPath, out);
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
