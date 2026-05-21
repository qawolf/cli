import { dirname } from "node:path";
import { z } from "zod";

import { isNoEntError } from "~/core/errors.js";
import { mkdir, readFile, writeFile } from "~/shell/fs.js";
import type { TeamStorageFile } from "~/shell/platform/types.js";

const assetManifestSchema = z.object({
  version: z.literal(1),
  files: z.array(
    z.object({
      etag: z.string().optional(),
      path: z.string(),
      size: z.number(),
      updatedAt: z.string().optional(),
    }),
  ),
});

export type AssetManifestEntry = z.infer<
  typeof assetManifestSchema
>["files"][number];

function assetManifestPath(assetsAbs: string): string {
  return `${assetsAbs}.manifest.json`;
}

export async function readAssetManifest(
  assetsAbs: string,
): Promise<Map<string, AssetManifestEntry>> {
  let raw: string;
  try {
    raw = await readFile(assetManifestPath(assetsAbs), "utf8");
  } catch (err: unknown) {
    if (isNoEntError(err)) return new Map();
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new Map();
  }

  const result = assetManifestSchema.safeParse(parsed);
  if (!result.success) return new Map();

  return new Map(result.data.files.map((file) => [file.path, file]));
}

export async function writeAssetManifest(
  assetsAbs: string,
  files: readonly TeamStorageFile[],
): Promise<void> {
  const manifest = {
    version: 1,
    files: files.map((file) => ({
      etag: file.etag,
      path: file.path,
      size: file.size,
      updatedAt: serializeDate(file.updatedAt),
    })),
  };
  const path = assetManifestPath(assetsAbs);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, undefined, 2)}\n`, "utf8");
}

function serializeDate(value: Date | string | undefined): string | undefined {
  return value instanceof Date ? value.toISOString() : value;
}
