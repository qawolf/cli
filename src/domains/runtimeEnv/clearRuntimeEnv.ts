import { type Fs } from "~/shell/fs.js";

import { managedEnvBaseDir } from "./managedEnvDir.js";

export type ClearRuntimeEnvResult = { dir: string; existed: boolean };

/**
 * Removes the entire managed runtime base directory (every versioned hash dir).
 * Honors QAWOLF_RUNTIME_DIR. Returns the resolved path and whether anything existed.
 */
export async function clearRuntimeEnv(fs: Fs): Promise<ClearRuntimeEnvResult> {
  const dir = managedEnvBaseDir();
  const existed = await fs.pathExists(dir);
  if (existed) await fs.rm(dir, { recursive: true, force: true });
  return { dir, existed };
}
