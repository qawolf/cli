import { basename } from "node:path";

import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { readManifest } from "~/shell/manifest/io.js";

/**
 * Names a pulled environment for display: its slug, else its display name,
 * else the directory (which is the canonical id).
 *
 * Environments pulled before slugs were recorded fall through to the id, which
 * is unfriendly but never wrong.
 */
export async function readEnvLabel(
  envDir: string,
  fs: Fs = makeDefaultFs(),
): Promise<string> {
  const manifest = await readManifest(envDir, fs);
  if (typeof manifest === "string") return basename(envDir);
  return manifest.envSlug ?? manifest.envName ?? basename(envDir);
}
