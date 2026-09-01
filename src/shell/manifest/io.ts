import { createHash } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";

import { isNoEntError } from "~/core/errors.js";
import { makeDefaultFs } from "~/shell/fs.js";
import type { Fs } from "~/shell/fs.js";
import type { Manifest } from "./types.js";

export const manifestFilename = ".manifest.json";

const flowEntrySchema = z.object({
  path: z.string(),
  contentHash: z.string(),
  // Absent on manifests written before tags existed, and on flows the tag
  // fetch did not return. Both optional so an older manifest still parses.
  tags: z.array(z.string()).optional(),
});

const manifestSchema = z.object({
  envId: z.string(),
  envSlug: z.string().optional(),
  envName: z.string().optional(),
  fetchedAt: z.string(),
  envVarsFetchedAt: z.string().optional(),
  cliFlowsVersion: z.string(),
  qawolfCommitSha: z.string().optional(),
  qawolfCommittedAt: z.string().optional(),
  tagsFetchedAt: z.string().optional(),
  flows: z.array(flowEntrySchema),
});

type ReadManifestResult = Manifest | "missing" | "malformed";

export async function readManifest(
  envDir: string,
  fs: Fs = makeDefaultFs(),
): Promise<ReadManifestResult> {
  let raw: string;
  try {
    raw = await fs.readFile(join(envDir, manifestFilename));
  } catch (err: unknown) {
    if (isNoEntError(err)) return "missing";
    // EACCES / EISDIR / other I/O errors aren't the same as "missing" or
    // "malformed"; rethrow so the caller can surface the real cause.
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "malformed";
  }

  const result = manifestSchema.safeParse(parsed);
  if (!result.success) return "malformed";

  return {
    envId: result.data.envId,
    envSlug: result.data.envSlug,
    envName: result.data.envName,
    fetchedAt: result.data.fetchedAt,
    envVarsFetchedAt: result.data.envVarsFetchedAt,
    cliFlowsVersion: result.data.cliFlowsVersion,
    qawolfCommitSha: result.data.qawolfCommitSha,
    qawolfCommittedAt: result.data.qawolfCommittedAt,
    tagsFetchedAt: result.data.tagsFetchedAt,
    flows: result.data.flows.map((flow) => ({
      path: flow.path,
      contentHash: flow.contentHash,
      tags: flow.tags,
    })),
  };
}

export async function writeManifest(
  envDir: string,
  manifest: Manifest,
  fs: Fs = makeDefaultFs(),
): Promise<void> {
  const body = JSON.stringify(manifest, undefined, 2);
  await fs.writeFile(join(envDir, manifestFilename), `${body}\n`);
}

export function hashFile(
  absPath: string,
  fs: Fs = makeDefaultFs(),
): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(absPath);
    stream.on("data", (chunk: Buffer) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}
