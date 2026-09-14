import { makeDefaultFs, type Fs } from "~/shell/fs.js";

import { readManifestEntries } from "./manifestEntries.js";

/** What a pull recorded about one flow; each field is undefined when unknown. */
export type CachedFlow = {
  /** Unknown, not untagged, until a tag fetch has succeeded for the env. */
  readonly tags: readonly string[] | undefined;
  /** Unknown when the flow was pulled before ids were kept. */
  readonly flowId: string | undefined;
};

/**
 * What the pull recorded for each flow, keyed by absolute path, reading each
 * environment's manifest once. Flows that were never pulled are absent.
 */
export async function readCachedFlows(
  files: readonly string[],
  fs: Fs = makeDefaultFs(),
): Promise<Map<string, CachedFlow>> {
  const flows = new Map<string, CachedFlow>();
  for (const [file, { entry, tagsFetchedAt }] of await readManifestEntries(
    files,
    fs,
  )) {
    flows.set(file, {
      tags: tagsFetchedAt === undefined ? undefined : entry.tags,
      flowId: entry.flowId,
    });
  }
  return flows;
}
