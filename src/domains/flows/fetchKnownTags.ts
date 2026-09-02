import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import type { AuthCommandContext } from "~/shell/commandContext.js";

const pageSize = 100;
// A team's tag list is small; this only stops a malformed cursor loop.
const maxPages = 20;

/**
 * Lists every tag name on the caller's team, or undefined when the platform
 * could not be reached.
 *
 * Undefined and an empty array mean different things: the caller uses this to
 * decide whether a selector names a real tag, and treating an outage as "no
 * tags exist" would report every name as a typo.
 */
export async function fetchKnownTags(
  ctx: AuthCommandContext,
): Promise<string[] | undefined> {
  const names: string[] = [];
  let cursor: string | undefined;

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const result = await ctx.platformClient.callPublicApi(
        publicContractsV1.tag.list,
        {
          includeFlowIds: false,
          limit: pageSize,
          ...(cursor === undefined ? {} : { cursor }),
        },
      );
      if (!result.ok) return undefined;

      names.push(...result.value.tags.map((tag) => tag.name));
      cursor = result.value.nextCursor;
      if (cursor === undefined) return names;
    }
  } catch {
    return undefined;
  }
  // The page cap was reached with more pages left. A partial list would make
  // the caller report a real tag from a later page as unknown, so say the
  // list is unavailable instead.
  return undefined;
}
