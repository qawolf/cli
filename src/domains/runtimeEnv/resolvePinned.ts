import { join } from "node:path";

import { appiumCliCandidates } from "~/core/nodeModulesBins.js";
import { playwrightCliJsPath } from "~/core/playwrightCli.js";
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

export type PinnedFailure =
  | {
      kind: "package";
      name: string;
      pinned: string;
      installed: string | undefined;
    }
  | { kind: "shim"; name: string; display: string };

// The same paths installBrowserList and createAppiumServer resolve from, so
// this check and those two cannot disagree. Playwright is spawned via its
// package's own cli.js (never the winner-takes-all .bin shim); appium still
// spawns the .bin shim.
const shims = [
  {
    name: "playwright",
    display: "node_modules/playwright/cli.js",
    candidates: (dir: string, _platform: NodeJS.Platform) => [
      playwrightCliJsPath(dir),
    ],
  },
  {
    name: "appium",
    display: "node_modules/.bin/appium",
    candidates: appiumCliCandidates,
  },
];

/**
 * Returns one entry per pinned package that is absent or installed at a
 * version other than the pinned one, plus one per missing CLI shim. An empty
 * array means the directory resolves. A matching package version does not
 * imply a runnable shim, so checking versions alone can resolve a root that
 * later fails to spawn the binary.
 */
export function pinnedResolutionFailures(
  dir: string,
  fs: Fs,
  platform: NodeJS.Platform,
): PinnedFailure[] {
  const failures: PinnedFailure[] = [];
  for (const { name, version } of pinnedPackages) {
    const installed = readInstalledVersion(dir, name, fs);
    if (installed !== version) {
      failures.push({ kind: "package", name, pinned: version, installed });
    }
  }
  for (const { name, display, candidates } of shims) {
    if (!candidates(dir, platform).some((p) => fs.existsSync(p))) {
      failures.push({ kind: "shim", name, display });
    }
  }
  return failures;
}

export function describePinnedFailure(failure: PinnedFailure): string {
  if (failure.kind === "shim") {
    return `${failure.display} (missing)`;
  }
  return failure.installed === undefined
    ? `${failure.name} (missing, pinned ${failure.pinned})`
    : `${failure.name} ${failure.installed} (pinned ${failure.pinned})`;
}

export function allPinnedResolved(
  dir: string,
  fs: Fs,
  platform: NodeJS.Platform,
): boolean {
  return pinnedResolutionFailures(dir, fs, platform).length === 0;
}
