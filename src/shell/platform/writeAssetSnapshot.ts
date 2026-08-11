import { dirname, join } from "node:path";

import type { Fs } from "~/shell/fs.js";
import { describeTeamStorageDownloadError } from "./describeErrors.js";
import { fetchSignedUrl } from "./fetchSignedUrl.js";
import type { ReusableAssetFile } from "./teamStorageAssetReuse.js";

/**
 * Per-file download progress: `current` is the file being downloaded, `total`
 * counts only files that actually download (reused and skipped files are
 * excluded).
 */
export type TeamStorageAssetProgress = {
  current: number;
  total: number;
};

type WriteAssetSnapshotArgs = {
  assetsAbs: string;
  deps: {
    fetch: typeof globalThis.fetch;
    fs: Fs;
    onProgress?: ((progress: TeamStorageAssetProgress) => void) | undefined;
  };
  reusable: ReadonlySet<string>;
  safeFiles: readonly ReusableAssetFile[];
  tmpAssets: string;
};

export async function writeAssetSnapshot(
  args: WriteAssetSnapshotArgs,
): Promise<number> {
  let downloadedCount = 0;
  const total = args.safeFiles.filter(
    ({ relativePath }) => !args.reusable.has(relativePath),
  ).length;
  await args.deps.fs.mkdir(args.tmpAssets, { recursive: true });

  for (const { file, relativePath } of args.safeFiles) {
    const dest = join(args.tmpAssets, relativePath);
    await args.deps.fs.mkdir(dirname(dest), { recursive: true });
    if (args.reusable.has(relativePath)) {
      await args.deps.fs.copyFile(join(args.assetsAbs, relativePath), dest);
      continue;
    }

    args.deps.onProgress?.({ current: downloadedCount + 1, total });
    const result = await fetchSignedUrl(
      { url: file.signedUrl, dest },
      { fetch: args.deps.fetch, fs: args.deps.fs },
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
