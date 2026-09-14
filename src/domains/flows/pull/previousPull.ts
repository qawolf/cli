import { toPosix } from "~/core/repoRelativePath.js";
import type { Fs } from "~/shell/fs.js";
import { readManifest } from "~/shell/manifest/io.js";

import type { FetchedTags } from "./bundle.js";

// A failed tag fetch must not erase cached tags or break offline tag queries.
export async function carriedFromPreviousPull(
  envDir: string,
  fs: Fs,
): Promise<{
  tags: FetchedTags | undefined;
}> {
  const previous = await readManifest(envDir, fs);
  if (typeof previous === "string") {
    return { tags: undefined };
  }

  const tagsByPath = new Map<string, string[]>();
  for (const flow of previous.flows) {
    // A manifest written by an older CLI on win32 may hold `\` paths; the new
    // manifest looks entries up by posix path, so normalize or the carried
    // values never match and vanish silently.
    const path = toPosix(flow.path);
    if (flow.tags !== undefined) tagsByPath.set(path, [...flow.tags]);
  }
  return {
    tags:
      previous.tagsFetchedAt === undefined
        ? undefined
        : { fetchedAt: new Date(previous.tagsFetchedAt), byPath: tagsByPath },
  };
}
