import { readFile, readdir, rename, rmdir, stat } from "~/shell/fs.js";
import { join, relative } from "node:path";
import { z } from "zod";

import { type Manifest, hashFile } from "./manifest.js";

// If `dir` contains exactly one entry and that entry is a directory, promote
// its contents up one level. Lets manifest paths be relative to the actual
// bundle contents rather than a content-hash wrapper directory.
export async function flattenSingleWrapper(dir: string): Promise<void> {
  const entries = await readdir(dir);
  if (entries.length !== 1) return;
  const innerName = entries[0];
  if (!innerName) return;
  const inner = join(dir, innerName);
  const innerStat = await stat(inner);
  if (!innerStat.isDirectory()) return;

  for (const e of await readdir(inner)) {
    await rename(join(inner, e), join(dir, e));
  }
  await rmdir(inner);
}

const flowExtensions = [".flow.ts", ".flow.js"];

const packageJsonSchema = z.object({
  dependencies: z
    .looseObject({ "@qawolf/flows": z.string().optional() })
    .optional(),
  devDependencies: z
    .looseObject({ "@qawolf/flows": z.string().optional() })
    .optional(),
});

export async function buildManifest(args: {
  envId: string;
  bundleDir: string;
  cliFlowsVersion: string;
  now: Date;
  envVarsFetchedAt: Date | undefined;
}): Promise<Manifest> {
  const flowPaths = await walkForFlows(args.bundleDir);
  const files = await Promise.all(
    flowPaths.map(async (rel) => ({
      path: rel,
      sha256: await hashFile(join(args.bundleDir, rel)),
    })),
  );
  const bundleFlowsVersion = await readBundleFlowsVersion(args.bundleDir);

  return {
    envId: args.envId,
    envSlug: undefined,
    fetchedAt: args.now.toISOString(),
    envVarsFetchedAt: args.envVarsFetchedAt?.toISOString(),
    cliFlowsVersion: args.cliFlowsVersion,
    bundleFlowsVersion,
    files,
  };
}

async function readBundleFlowsVersion(
  bundleDir: string,
): Promise<string | undefined> {
  let raw: string;
  try {
    raw = await readFile(join(bundleDir, "package.json"), "utf8");
  } catch {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const result = packageJsonSchema.safeParse(parsed);
  if (!result.success) return undefined;
  return (
    result.data.dependencies?.["@qawolf/flows"] ??
    result.data.devDependencies?.["@qawolf/flows"]
  );
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
