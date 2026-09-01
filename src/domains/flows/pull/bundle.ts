import { join, relative } from "node:path";

import { hashFile } from "~/shell/manifest/io.js";
import type { Manifest } from "~/shell/manifest/types.js";
import { makeDefaultFs } from "~/shell/fs.js";
import type { Fs } from "~/shell/fs.js";

// If `dir` contains exactly one entry and that entry is a directory, promote
// its contents up one level and return the wrapper directory's name. Lets
// downstream code recover the GitHub-archive wrapper (`<owner>-<repo>-<sha>`)
// so the bundle's source commit can be recorded in the manifest.
export async function flattenSingleWrapper(
  dir: string,
  fs: Fs = makeDefaultFs(),
): Promise<string | undefined> {
  const entries = await fs.readdir(dir);
  if (entries.length !== 1) return undefined;
  const innerName = entries[0];
  if (!innerName) return undefined;
  const inner = join(dir, innerName);
  const innerStat = await fs.stat(inner);
  if (!innerStat.isDirectory()) return undefined;

  for (const e of await fs.readdir(inner)) {
    await fs.rename(join(inner, e), join(dir, e));
  }
  // Verify empty before removal — preserves the original rmdir safety
  // guarantee that unexpected leftover content causes a hard failure.
  const leftovers = await fs.readdir(inner);
  if (leftovers.length > 0) {
    throw new Error(
      `flattenSingleWrapper: ${leftovers.length} unexpected item(s) remain in wrapper dir`,
    );
  }
  await fs.rm(inner, { recursive: true });
  return innerName;
}

// GitHub's tarball archives wrap content in `<owner>-<repo>-<sha>/`, where
// the trailing 40 hex chars are the commit SHA. Defensive: returns undefined
// when the wrapper name doesn't match — keeps manifest writes infallible.
function extractQawolfCommitSha(
  wrapperName: string | undefined,
): string | undefined {
  if (!wrapperName) return undefined;
  return /-([0-9a-f]{40})$/i.exec(wrapperName)?.[1];
}

const toPosix = (p: string): string => p.replaceAll("\\", "/");

const flowExtensions = [".flow.ts", ".flow.js"];

/**
 * Tags fetched for an env at pull time, keyed by repo-relative flow path.
 * Undefined when the fetch did not happen or failed.
 */
export type FetchedTags = {
  fetchedAt: Date;
  byPath: Map<string, string[]>;
};

export async function buildManifest(
  args: {
    envId: string;
    bundleDir: string;
    cliFlowsVersion: string;
    now: Date;
    envVarsFetchedAt: Date | undefined;
    wrapperName: string | undefined;
    qawolfCommittedAt: string | undefined;
    tags: FetchedTags | undefined;
  },
  fs: Fs = makeDefaultFs(),
): Promise<Manifest> {
  const flowPaths = await walkForFlows(args.bundleDir, fs);
  const flows = await Promise.all(
    flowPaths.map(async (rel) => ({
      // Stored posix so a manifest written on one platform resolves on
      // another. Every reader compares against this, so normalizing once
      // here beats normalizing in each of them.
      path: toPosix(rel),
      contentHash: await hashFile(join(args.bundleDir, rel), fs),
      // Left unset when the fetch did not cover this file — unknown, not
      // untagged.
      tags: args.tags?.byPath.get(toPosix(rel)),
    })),
  );

  return {
    envId: args.envId,
    envSlug: undefined,
    fetchedAt: args.now.toISOString(),
    envVarsFetchedAt: args.envVarsFetchedAt?.toISOString(),
    cliFlowsVersion: args.cliFlowsVersion,
    qawolfCommitSha: extractQawolfCommitSha(args.wrapperName),
    qawolfCommittedAt: args.qawolfCommittedAt,
    tagsFetchedAt: args.tags?.fetchedAt.toISOString(),
    flows,
  };
}

async function walkForFlows(root: string, fs: Fs): Promise<string[]> {
  const out: string[] = [];
  await walk(root, root, out, fs);
  return out.sort();
}

async function walk(
  current: string,
  root: string,
  out: string[],
  fs: Fs,
): Promise<void> {
  const entries = await fs.readdirWithTypes(current);
  for (const e of entries) {
    const abs = join(current, e.name);
    if (e.isDirectory()) {
      await walk(abs, root, out, fs);
    } else if (
      e.isFile() &&
      flowExtensions.some((ext) => e.name.endsWith(ext))
    ) {
      out.push(relative(root, abs));
    }
  }
}

// Samples the mtime of any flow file in the bundle. GitHub-archive bundles
// share one mtime across all entries (preserved by extract.ts). Returns
// undefined when the bundle has no flow files. Sample BEFORE any local
// rewrite pass — otherwise the mtime reflects our write, not the source.
export async function sampleQawolfCommittedAt(
  bundleDir: string,
  fs: Fs = makeDefaultFs(),
): Promise<string | undefined> {
  const flowPaths = await walkForFlows(bundleDir, fs);
  const sample = flowPaths[0];
  if (!sample) return undefined;
  return (await fs.stat(join(bundleDir, sample))).mtime.toISOString();
}
