import type { CachedFlow } from "./readCachedFlows.js";

/** What `readCachedFlows` returns when the pulls recorded only these tags. */
export const cachedFlowsWithTags = (
  tagsByFile: Record<string, readonly string[]>,
): Map<string, CachedFlow> =>
  new Map(
    Object.entries(tagsByFile).map(([file, tags]) => [
      file,
      {
        tags,
        flowId: undefined,
      },
    ]),
  );
