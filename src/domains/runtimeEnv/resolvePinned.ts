import { join } from "node:path";

import { playwrightCliCandidates } from "~/core/playwrightBins.js";
import type { Fs } from "~/shell/fs.js";

import { pinnedPackages } from "./pinnedPackages.js";

/**
 * Reads the installed version of a package from its package.json inside
 * node_modules. Returns undefined on any error (missing, malformed JSON, no
 * version field).
 */
export function readInstalledVersion(
  dir: string,
  pkgName: string,
  fs: Fs,
): string | undefined {
  try {
    const pkgPath = join(
      dir,
      "node_modules",
      ...pkgName.split("/"),
      "package.json",
    );
    const raw = JSON.parse(fs.readFileSync(pkgPath)) as { version?: unknown };
    const { version } = raw;
    return typeof version === "string" ? version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns true when every pinned package is installed at its exact pinned
 * version AND a Playwright shim exists (required by installBrowserList).
 */
export function allPinnedResolved(
  dir: string,
  fs: Fs,
  platform: NodeJS.Platform,
): boolean {
  // Same list installBrowserList resolves from, so the two cannot disagree.
  const hasPlaywrightShim = playwrightCliCandidates(dir, platform).some(
    (path) => fs.existsSync(path),
  );
  if (!hasPlaywrightShim) {
    return false;
  }
  return pinnedPackages.every(
    ({ name, version }) => readInstalledVersion(dir, name, fs) === version,
  );
}
