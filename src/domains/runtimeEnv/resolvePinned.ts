import { join } from "node:path";

import { appiumCliCandidates } from "~/core/appiumBins.js";
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
 * version AND both CLI shims exist. A matching package version does not imply
 * a runnable shim, so checking versions alone can resolve a root that later
 * fails to spawn the binary.
 */
export function allPinnedResolved(
  dir: string,
  fs: Fs,
  platform: NodeJS.Platform,
): boolean {
  // The same candidate lists installBrowserList and createAppiumServer resolve
  // from, so this check and those two cannot disagree.
  const shimsPresent = [playwrightCliCandidates, appiumCliCandidates].every(
    (candidates) => candidates(dir, platform).some((p) => fs.existsSync(p)),
  );
  if (!shimsPresent) {
    return false;
  }
  return pinnedPackages.every(
    ({ name, version }) => readInstalledVersion(dir, name, fs) === version,
  );
}
