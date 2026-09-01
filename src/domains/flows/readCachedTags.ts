import { relative } from "node:path";

import { toPosix } from "~/core/repoRelativePath.js";

import { findPulledEnvDir } from "~/core/repoRelativePath.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { readManifest } from "~/shell/manifest/io.js";

/**
 * Reads the tags cached at pull time for each flow, keyed by absolute path.
 *
 * A flow is absent from the result whenever its tags are unknown — it was
 * never pulled, its manifest predates tags, or the tag fetch did not cover it.
 * Absence therefore means "unknown", never "untagged".
 */
export async function readCachedTags(
  files: readonly string[],
  fs: Fs = makeDefaultFs(),
): Promise<Map<string, readonly string[]>> {
  // Group by env dir so a listing of many flows reads each manifest once
  // rather than once per flow.
  const filesByEnvDir = new Map<string, string[]>();
  for (const file of files) {
    const envDir = findPulledEnvDir(file);
    if (envDir === undefined) continue;
    const group = filesByEnvDir.get(envDir);
    if (group) group.push(file);
    else filesByEnvDir.set(envDir, [file]);
  }

  const tagsByFile = new Map<string, readonly string[]>();
  for (const [envDir, envFiles] of filesByEnvDir) {
    const manifest = await readManifest(envDir, fs);
    if (typeof manifest === "string") continue;
    // No fetch ever happened for this env, so every entry is unknown.
    if (manifest.tagsFetchedAt === undefined) continue;

    const entryByPath = new Map(
      manifest.flows.map((f) => [toPosix(f.path), f]),
    );
    for (const file of envFiles) {
      const tags = entryByPath.get(toPosix(relative(envDir, file)))?.tags;
      if (tags !== undefined) tagsByFile.set(file, tags);
    }
  }
  return tagsByFile;
}
