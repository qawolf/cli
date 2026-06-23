import { join } from "node:path";

import { type Fs } from "~/shell/fs.js";

import { managedEnvBaseDir } from "./managedEnvDir.js";

// Marker written into every managed hash dir's package.json by scaffoldManagedEnv.
const runtimeSentinel = "qawolf-runtime";

export type ClearRuntimeEnvResult = { dir: string; existed: boolean };

/**
 * Removes the entire managed runtime base directory (every versioned hash dir).
 * Honors QAWOLF_RUNTIME_DIR. Returns the resolved path and whether anything existed.
 * Fails closed when the resolved dir is not a managed runtime — a misconfigured
 * QAWOLF_RUNTIME_DIR (e.g. a repo root) must never be recursively deleted.
 */
export async function clearRuntimeEnv(fs: Fs): Promise<ClearRuntimeEnvResult> {
  const dir = managedEnvBaseDir();
  const existed = await fs.pathExists(dir);
  if (!existed) return { dir, existed };

  if (!(await isManagedRuntimeBase(dir, fs))) {
    throw new Error(
      `Refusing to delete ${dir}: it does not look like a QA Wolf managed ` +
        `runtime directory (expected only ${runtimeSentinel} hash dirs). ` +
        `Check your QAWOLF_RUNTIME_DIR override.`,
    );
  }

  await fs.rm(dir, { recursive: true, force: true });
  return { dir, existed };
}

// A managed base contains only versioned hash dirs, each scaffolded with a
// package.json named "qawolf-runtime". Empty is fine (nothing of value to lose);
// any other entry means the path is not ours, so refuse to delete it.
async function isManagedRuntimeBase(dir: string, fs: Fs): Promise<boolean> {
  const entries = await fs.readdirWithTypes(dir);
  for (const entry of entries) {
    if (!entry.isDirectory()) return false;
    if (!(await hasRuntimeSentinel(join(dir, entry.name), fs))) return false;
  }
  return true;
}

async function hasRuntimeSentinel(hashDir: string, fs: Fs): Promise<boolean> {
  try {
    const pkg = JSON.parse(
      await fs.readFile(join(hashDir, "package.json")),
    ) as {
      name?: string;
    };
    return pkg.name === runtimeSentinel;
  } catch {
    return false;
  }
}
