import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { toPosix } from "~/core/repoRelativePath.js";
import type { AuthCommandContext } from "~/shell/commandContext.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { readManifest } from "~/shell/manifest/io.js";

type TagsByPath = Map<string, readonly string[]>;

export type TagResolution =
  | { kind: "live"; byPath: TagsByPath }
  | { kind: "cached"; byPath: TagsByPath; fetchedAt: string }
  /** Tags were never cached for this env and the platform is unreachable. */
  | { kind: "unavailable" };

async function fetchLive(
  ctx: AuthCommandContext,
  envId: string,
): Promise<TagsByPath | undefined> {
  try {
    const result = await ctx.platformClient.callPublicApi(
      publicContractsV1.flow.list,
      { environmentId: envId, includeDrafts: true },
    );
    if (!result.ok) return undefined;
    return new Map(result.value.flows.map((f) => [f.path, f.tags]));
  } catch {
    return undefined;
  }
}

async function readCache(
  envDir: string,
  fs: Fs,
): Promise<{ byPath: TagsByPath; fetchedAt: string } | undefined> {
  const manifest = await readManifest(envDir, fs);
  if (typeof manifest === "string") return undefined;
  // Without a fetch timestamp the manifest predates tags: every entry is
  // unknown, so there is nothing here to answer a tag query with.
  if (manifest.tagsFetchedAt === undefined) return undefined;

  const byPath: TagsByPath = new Map();
  for (const flow of manifest.flows) {
    // A manifest written by an older CLI on win32 may hold `\` paths; callers
    // look up posix repo-relative paths, so normalize or they never match.
    if (flow.tags !== undefined) byPath.set(toPosix(flow.path), flow.tags);
  }
  return { byPath, fetchedAt: manifest.tagsFetchedAt };
}

/**
 * Resolves the tags of an env's flows, keyed by repo-relative path.
 *
 * Tags are platform state that changes independently of the flow files, so
 * the live listing wins whenever it is reachable. The cache written at pull
 * time is the fallback, which keeps an offline run working at the cost of
 * possibly-stale tags — the caller is expected to say so.
 */
export async function resolveTags(
  ctx: AuthCommandContext,
  envId: string,
  envDir: string,
  fs: Fs = makeDefaultFs(),
): Promise<TagResolution> {
  const live = await fetchLive(ctx, envId);
  if (live) return { kind: "live", byPath: live };

  const cached = await readCache(envDir, fs);
  if (cached) {
    return {
      kind: "cached",
      byPath: cached.byPath,
      fetchedAt: cached.fetchedAt,
    };
  }
  return { kind: "unavailable" };
}
