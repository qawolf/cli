import { dirname, join } from "node:path";

import { copyFile, mkdir, pathExists } from "~/shell/fs.js";
import { fetchSignedUrl } from "~/shell/platform/fetchSignedUrl.js";
import type { TeamStorageFile } from "~/shell/platform/types.js";
import {
  cleanupTempDir,
  hasExactAssetSnapshot,
  replaceAssetsDir,
} from "./assetSnapshot.js";
import { readAssetManifest, writeAssetManifest } from "./assetManifest.js";
import { createTempPathRegistry, mintTempPath } from "./safeRemove.js";
import { safeAssetPath } from "./safeAssetPath.js";
import { describeTeamStorageDownloadError } from "./wireErrors.js";

export type DownloadTeamStorageAssetsResult = {
  downloadedCount: number;
  reusedCount: number;
  skippedCount: number;
};

type DownloadTeamStorageAssetsArgs = {
  assetsAbs: string;
  files: readonly TeamStorageFile[];
};

type DownloadTeamStorageAssetsDeps = {
  fetch: typeof globalThis.fetch;
};

export async function downloadTeamStorageAssets(
  args: DownloadTeamStorageAssetsArgs,
  deps: DownloadTeamStorageAssetsDeps = { fetch: globalThis.fetch },
): Promise<DownloadTeamStorageAssetsResult> {
  const registry = createTempPathRegistry();
  const tmpAssets = mintTempPath(args.assetsAbs, "pull", registry);
  const manifest = await readAssetManifest(args.assetsAbs);
  const safeFiles = collectSafeFiles(args.files);
  const skippedCount = args.files.length - safeFiles.length;
  const reusable = await reusablePaths(args.assetsAbs, safeFiles, manifest);
  const reusedCount = reusable.size;

  if (
    reusedCount === safeFiles.length &&
    (await hasExactAssetSnapshot(
      args.assetsAbs,
      safeFiles.map((file) => file.relativePath),
    ))
  ) {
    return { downloadedCount: 0, reusedCount, skippedCount };
  }

  try {
    const downloadedCount = await writeAssetSnapshot({
      assetsAbs: args.assetsAbs,
      deps,
      reusable,
      safeFiles,
      tmpAssets,
    });
    await replaceAssetsDir(args.assetsAbs, tmpAssets, registry);
    await writeAssetManifest(
      args.assetsAbs,
      safeFiles.map(({ file, relativePath }) => ({
        ...file,
        path: relativePath,
      })),
    );
    return { downloadedCount, reusedCount, skippedCount };
  } catch (err) {
    await cleanupTempDir(tmpAssets, registry);
    throw err;
  }
}

type SafeFile = { file: TeamStorageFile; relativePath: string };

function collectSafeFiles(files: readonly TeamStorageFile[]): SafeFile[] {
  const safeFiles: SafeFile[] = [];
  for (const file of files) {
    const relativePath = safeAssetPath(file.path);
    if (relativePath !== undefined) safeFiles.push({ file, relativePath });
  }
  return safeFiles;
}

async function reusablePaths(
  assetsAbs: string,
  safeFiles: readonly SafeFile[],
  manifest: Map<string, { etag?: string | undefined }>,
): Promise<Set<string>> {
  const reusable = new Set<string>();
  for (const { file, relativePath } of safeFiles) {
    if (await canReuseAsset(assetsAbs, relativePath, file, manifest)) {
      reusable.add(relativePath);
    }
  }
  return reusable;
}

type WriteAssetSnapshotArgs = {
  assetsAbs: string;
  deps: DownloadTeamStorageAssetsDeps;
  reusable: ReadonlySet<string>;
  safeFiles: readonly SafeFile[];
  tmpAssets: string;
};

async function writeAssetSnapshot(
  args: WriteAssetSnapshotArgs,
): Promise<number> {
  let downloadedCount = 0;
  await mkdir(args.tmpAssets, { recursive: true });

  for (const { file, relativePath } of args.safeFiles) {
    const dest = join(args.tmpAssets, relativePath);
    await mkdir(dirname(dest), { recursive: true });
    if (args.reusable.has(relativePath)) {
      await copyFile(join(args.assetsAbs, relativePath), dest);
      continue;
    }

    const result = await fetchSignedUrl(
      { url: file.signedUrl, dest },
      { fetch: args.deps.fetch },
    );
    if (!result.ok) {
      throw new Error(
        describeTeamStorageDownloadError(file.path, result.error),
      );
    }
    downloadedCount++;
  }

  return downloadedCount;
}

async function canReuseAsset(
  assetsAbs: string,
  relativePath: string,
  file: TeamStorageFile,
  manifest: Map<string, { etag?: string | undefined }>,
): Promise<boolean> {
  if (file.etag === undefined) return false;
  const previous = manifest.get(relativePath);
  if (previous?.etag !== file.etag) return false;
  return pathExists(join(assetsAbs, relativePath));
}
