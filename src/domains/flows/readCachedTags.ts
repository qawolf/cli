import { makeDefaultFs, type Fs } from "~/shell/fs.js";

import { readManifestEntries } from "./manifestEntries.js";

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
  const tagsByFile = new Map<string, readonly string[]>();
  for (const [file, { entry, tagsFetchedAt }] of await readManifestEntries(
    files,
    fs,
  )) {
    if (tagsFetchedAt === undefined || entry.tags === undefined) continue;
    tagsByFile.set(file, entry.tags);
  }
  return tagsByFile;
}
