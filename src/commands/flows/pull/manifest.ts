// TODO WIZ-10356: replace this stub with the canonical manifest format.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

export const manifestFilename = ".manifest.json";

const fileSchema = z.object({
  path: z.string(),
  sha256: z.string(),
});

const manifestSchema = z.object({
  envId: z.string(),
  envSlug: z.string().optional(),
  fetchedAt: z.string(),
  cliFlowsVersion: z.string(),
  bundleFlowsVersion: z.string().optional(),
  files: z.array(fileSchema),
});

export type Manifest = {
  envId: string;
  envSlug: string | undefined;
  fetchedAt: string;
  cliFlowsVersion: string;
  bundleFlowsVersion: string | undefined;
  files: { path: string; sha256: string }[];
};

type ReadManifestResult = Manifest | "missing" | "malformed";

export async function readManifest(
  envDir: string,
): Promise<ReadManifestResult> {
  let raw: string;
  try {
    raw = await readFile(join(envDir, manifestFilename), "utf8");
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
    fetchedAt: result.data.fetchedAt,
    cliFlowsVersion: result.data.cliFlowsVersion,
    bundleFlowsVersion: result.data.bundleFlowsVersion,
    files: result.data.files,
  };
}

export async function writeManifest(
  envDir: string,
  manifest: Manifest,
): Promise<void> {
  const body = JSON.stringify(manifest, undefined, 2);
  await writeFile(join(envDir, manifestFilename), `${body}\n`, "utf8");
}

export function hashFile(absPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(absPath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

function isNoEntError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}
