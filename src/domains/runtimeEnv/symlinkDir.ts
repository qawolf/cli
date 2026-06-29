import { symlink } from "node:fs/promises";

/**
 * Creates a directory symlink (or Windows junction) at `target` pointing to
 * `source`. Prefers junction on win32 to avoid requiring elevated privileges
 * or Developer Mode.
 */
export async function createDirSymlink(
  source: string,
  target: string,
): Promise<void> {
  const linkType = process.platform === "win32" ? "junction" : "dir";
  await symlink(source, target, linkType);
}
