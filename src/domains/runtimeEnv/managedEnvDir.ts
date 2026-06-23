import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

import type { Fs } from "~/shell/fs.js";
import { getDataDir } from "~/core/paths.js";

import { pinnedPackages } from "./pinnedPackages.js";

/**
 * Deterministic 16-hex-char SHA-256 digest of the pinned package specs. A
 * new hash is produced whenever any pinned version changes, so each release
 * gets its own isolated install directory.
 */
export function managedEnvHash(): string {
  const content = pinnedPackages
    .map(({ name, version }) => `${name}@${version}`)
    .join("\n");
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Base directory the versioned managed runtime installs under. `QAWOLF_RUNTIME_DIR`
 * relocates it (resolved to an absolute path; empty/whitespace falls back) so CI,
 * airgapped, and non-writable-$HOME setups can move the cache — the same affordance
 * as PLAYWRIGHT_BROWSERS_PATH / CYPRESS_CACHE_FOLDER. The `--deps` flag is a separate,
 * higher-priority validate-only override handled in ensureRuntimeEnv.
 */
export function managedEnvBaseDir(): string {
  const override = process.env["QAWOLF_RUNTIME_DIR"]?.trim();
  if (override) return resolve(override);
  return join(getDataDir(), "runtime");
}

/** Absolute path to the versioned managed runtime directory. */
export function managedEnvDir(): string {
  return join(managedEnvBaseDir(), managedEnvHash());
}

/**
 * Creates `dir` recursively and writes a private package.json listing all
 * pinned dependencies so `npm install` can populate them. Also writes an
 * `.npmrc` pinning the @qawolf scope to public npm — the managed dir has no
 * project `.npmrc`, so without this a developer whose global config redirects
 * @qawolf to a private registry (e.g. GitHub Packages) would fail to install.
 */
export async function scaffoldManagedEnv(dir: string, fs: Fs): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const dependencies = Object.fromEntries(
    pinnedPackages.map(({ name, version }) => [name, version]),
  );
  await fs.writeFile(
    join(dir, "package.json"),
    JSON.stringify(
      { name: "qawolf-runtime", private: true, dependencies },
      undefined,
      2,
    ),
  );
  await fs.writeFile(
    join(dir, ".npmrc"),
    "@qawolf:registry=https://registry.npmjs.org/\n",
  );
}
