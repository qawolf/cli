import { join } from "node:path";

import { isNoEntError } from "~/core/errors.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { readManifest } from "./io.js";

export type PulledEnv = {
  /** Absolute `.qawolf/<id>/` directory of the pulled environment. */
  readonly dir: string;
  /** Canonical environment id from the manifest, the cache's address. */
  readonly envId: string;
};

/**
 * Finds a pulled environment by id, or by the slug or display name recorded
 * at pull time.
 *
 * Name is matched because labels shown to the user are built the same way
 * (slug, else name, else id): everything the CLI can print as an environment
 * must also be accepted back. The canonical id is returned with the directory
 * so callers never derive one from the other. A slug or name can be renamed
 * on the platform, which makes this a convenience for working offline rather
 * than a substitute for resolving the environment when it can be reached.
 */
export async function findPulledEnv(
  ref: string,
  cwd: string,
  fs: Fs = makeDefaultFs(),
): Promise<PulledEnv | undefined> {
  for (const envDir of await listPulledEnvDirs(cwd, fs)) {
    const manifest = await readManifest(envDir, fs);
    if (typeof manifest === "string") continue;
    if (
      manifest.envId === ref ||
      manifest.envSlug === ref ||
      manifest.envName === ref
    ) {
      return { dir: envDir, envId: manifest.envId };
    }
  }
  return undefined;
}

/**
 * Lists every pulled environment directory under `cwd/.qawolf`, as absolute
 * paths. A directory without a usable manifest is not a pulled environment.
 */
export async function listPulledEnvDirs(
  cwd: string,
  fs: Fs = makeDefaultFs(),
): Promise<string[]> {
  const root = join(cwd, ".qawolf");

  let entries: Awaited<ReturnType<Fs["readdirWithTypes"]>>;
  try {
    entries = await fs.readdirWithTypes(root);
  } catch (err: unknown) {
    // A missing .qawolf means nothing has been pulled here. EACCES and other
    // I/O failures are a different answer, so they surface rather than
    // becoming a wrong "environment not found".
    if (isNoEntError(err)) return [];
    throw err;
  }

  const dirs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const envDir = join(root, entry.name);
    const manifest = await readManifest(envDir, fs);
    if (typeof manifest === "string") continue;
    dirs.push(envDir);
  }
  return dirs;
}
