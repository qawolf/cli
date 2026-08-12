import { errorMessage } from "~/core/errors.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";
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
import {
  writeAssetSnapshot,
  type TeamStorageAssetProgress,
} from "./writeAssetSnapshot.js";

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
  fs?: Fs | undefined;
  onProgress?: ((progress: TeamStorageAssetProgress) => void) | undefined;
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
  const fs = deps.fs ?? makeDefaultFs();
  const tmpAssets = mintAssetSnapshotPath(args.assetsAbs, "pull");
  const manifest = await readAssetManifest(args.assetsAbs, fs);
  const safeFiles: ReusableAssetFile[] = [];
  for (const file of args.files) {
    const relativePath = safeAssetPath(file.path);
    if (relativePath !== undefined) safeFiles.push({ file, relativePath });
  }
  const skippedCount = args.files.length - safeFiles.length;
  const reusable = await reusableAssetPaths(
    args.assetsAbs,
    safeFiles,
    manifest,
    fs,
  );
  const reusedCount = reusable.size;

  if (
    reusedCount === safeFiles.length &&
    (await hasExactAssetSnapshot(
      args.assetsAbs,
      safeFiles.map((file) => file.relativePath),
      fs,
    ))
  ) {
    return { downloadedCount: 0, reusedCount, skippedCount };
  }

  try {
    const downloadedCount = await writeAssetSnapshot({
      assetsAbs: args.assetsAbs,
      deps: { fetch: deps.fetch, fs, onProgress: deps.onProgress },
      reusable,
      safeFiles,
      tmpAssets,
    });
    await replaceAssetsDir(args.assetsAbs, tmpAssets, fs);
    await writeAssetManifest(
      args.assetsAbs,
      safeFiles.map(({ file, relativePath }) => ({
        ...file,
        path: relativePath,
      })),
      fs,
    );
    return { downloadedCount, reusedCount, skippedCount };
  } catch (error: unknown) {
    await cleanupAssetSnapshot(tmpAssets, fs);
    throw error;
  }
}
