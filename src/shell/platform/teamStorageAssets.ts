import { dirname, join } from "node:path";

import { errorMessage } from "~/core/errors.js";
import { copyFile, mkdir } from "~/shell/fs.js";
import { describeTeamStorageDownloadError } from "./describeErrors.js";
import { fetchSignedUrl } from "./fetchSignedUrl.js";
import type { PlatformResult } from "./requestWithRetry.js";
import {
  readAssetManifest,
  writeAssetManifest,
} from "./teamStorageAssetManifest.js";
import { safeAssetPath } from "./teamStorageAssetPath.js";
import {
  cleanupAssetSnapshot,
  hasExactAssetSnapshot,
  mintAssetSnapshotPath,
  replaceAssetsDir,
} from "./teamStorageAssetSnapshot.js";
import {
  reusableAssetPaths,
  type ReusableAssetFile,
} from "./teamStorageAssetReuse.js";
import type { TeamStorageFile } from "./types.js";

export type SyncTeamStorageAssetsResult = {
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
): Promise<PlatformResult<SyncTeamStorageAssetsResult>> {
  try {
    return {
      ok: true,
      value: await writeTeamStorageAssets(args, deps),
    };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  }
}

async function writeTeamStorageAssets(
  args: DownloadTeamStorageAssetsArgs,
  deps: DownloadTeamStorageAssetsDeps,
): Promise<SyncTeamStorageAssetsResult> {
  const tmpAssets = mintAssetSnapshotPath(args.assetsAbs, "pull");
  const manifest = await readAssetManifest(args.assetsAbs);
  const safeFiles = collectSafeFiles(args.files);
  const skippedCount = args.files.length - safeFiles.length;
  const reusable = await reusableAssetPaths(
    args.assetsAbs,
    safeFiles,
    manifest,
  );
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
    await replaceAssetsDir(args.assetsAbs, tmpAssets);
    await writeAssetManifest(
      args.assetsAbs,
      safeFiles.map(({ file, relativePath }) => ({
        ...file,
        path: relativePath,
      })),
    );
    return { downloadedCount, reusedCount, skippedCount };
  } catch (error: unknown) {
    await cleanupAssetSnapshot(tmpAssets);
    throw error;
  }
}

function collectSafeFiles(
  files: readonly TeamStorageFile[],
): ReusableAssetFile[] {
  const safeFiles: ReusableAssetFile[] = [];
  for (const file of files) {
    const relativePath = safeAssetPath(file.path);
    if (relativePath !== undefined) safeFiles.push({ file, relativePath });
  }
  return safeFiles;
}

type WriteAssetSnapshotArgs = {
  assetsAbs: string;
  deps: DownloadTeamStorageAssetsDeps;
  reusable: ReadonlySet<string>;
  safeFiles: readonly ReusableAssetFile[];
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
