import { join, relative } from "node:path";

import { hashFile } from "~/shell/manifest/io.js";
import type { Manifest } from "~/shell/manifest/types.js";
import { readdir, rename, rmdir, stat } from "~/shell/fs.js";

// If `dir` contains exactly one entry and that entry is a directory, promote
// its contents up one level and return the wrapper directory's name. Lets
// downstream code recover the GitHub-archive wrapper (`<owner>-<repo>-<sha>`)
// so the bundle's source commit can be recorded in the manifest.
export async function flattenSingleWrapper(
  dir: string,
): Promise<string | undefined> {
  const entries = await readdir(dir);
  if (entries.length !== 1) return undefined;
  const innerName = entries[0];
  if (!innerName) return undefined;
  const inner = join(dir, innerName);
  const innerStat = await stat(inner);
  if (!innerStat.isDirectory()) return undefined;

  for (const e of await readdir(inner)) {
    await rename(join(inner, e), join(dir, e));
  }
  await rmdir(inner);
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

const flowExtensions = [".flow.ts", ".flow.js"];

export async function buildManifest(args: {
  envId: string;
  bundleDir: string;
  cliFlowsVersion: string;
  now: Date;
  envVarsFetchedAt: Date | undefined;
  wrapperName: string | undefined;
}): Promise<Manifest> {
  const flowPaths = await walkForFlows(args.bundleDir);
  const flows = await Promise.all(
    flowPaths.map(async (rel) => ({
      path: rel,
      contentHash: await hashFile(join(args.bundleDir, rel)),
    })),
  );
  // Sample any flow file's mtime as commit time — all entries share it via
  // tar's mtime preservation applied in extract.ts.
  const sampleFlow = flowPaths[0];
  const qawolfCommittedAt = sampleFlow
    ? (await stat(join(args.bundleDir, sampleFlow))).mtime.toISOString()
    : undefined;

  return {
    envId: args.envId,
    envSlug: undefined,
    fetchedAt: args.now.toISOString(),
    envVarsFetchedAt: args.envVarsFetchedAt?.toISOString(),
    cliFlowsVersion: args.cliFlowsVersion,
    qawolfCommitSha: extractQawolfCommitSha(args.wrapperName),
    qawolfCommittedAt,
    flows,
  };
}

async function walkForFlows(root: string): Promise<string[]> {
  const out: string[] = [];
  await walk(root, root, out);
  return out.sort();
}

async function walk(
  current: string,
  root: string,
  out: string[],
): Promise<void> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const e of entries) {
    const abs = join(current, e.name);
    if (e.isDirectory()) {
      await walk(abs, root, out);
    } else if (
      e.isFile() &&
      flowExtensions.some((ext) => e.name.endsWith(ext))
    ) {
      out.push(relative(root, abs));
    }
  }
}
