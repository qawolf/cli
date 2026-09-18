import { relative } from "node:path";

import { findPulledEnvDir, toPosix } from "~/core/repoRelativePath.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { readManifest } from "~/shell/manifest/io.js";
import type { Manifest } from "~/shell/manifest/types.js";

type RecordedFlow = {
  readonly entry: Manifest["flows"][number];
  /** Undefined when no tag fetch ever succeeded for the flow's environment. */
  readonly tagsFetchedAt: string | undefined;
};

/** Keyed by absolute path; flows outside a pulled manifest are absent. */
export async function readManifestEntries(
  files: readonly string[],
  fs: Fs = makeDefaultFs(),
): Promise<Map<string, RecordedFlow>> {
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

  const entries = new Map<string, RecordedFlow>();
  for (const [envDir, envFiles] of filesByEnvDir) {
    const manifest = await readManifest(envDir, fs);
    if (typeof manifest === "string") continue;
    // Compared posix on both sides: a manifest written on win32 by an older
    // CLI may hold `\` paths.
    const byPath = new Map(manifest.flows.map((f) => [toPosix(f.path), f]));
    for (const file of envFiles) {
      const entry = byPath.get(toPosix(relative(envDir, file)));
      if (entry !== undefined) {
        entries.set(file, { entry, tagsFetchedAt: manifest.tagsFetchedAt });
      }
    }
  }
  return entries;
}
