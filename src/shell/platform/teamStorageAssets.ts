import { randomBytes } from "node:crypto";
import { dirname, join, isAbsolute, normalize, sep } from "node:path";

import { errorMessage } from "~/core/errors.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";
import { describeTeamStorageDownloadError } from "./describeErrors.js";
import { fetchSignedUrl } from "./fetchSignedUrl.js";
import type { PlatformResult } from "./requestWithRetry.js";
import type { TeamStorageFile } from "./types.js";

export type SyncTeamStorageAssetsResult = {
  downloadedCount: number;
  skippedCount: number;
};

type DownloadTeamStorageAssetsArgs = {
  assetsAbs: string;
  files: readonly TeamStorageFile[];
};

type DownloadTeamStorageAssetsDeps = {
  fetch: typeof globalThis.fetch;
  fs?: Fs | undefined;
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
  const tmpAssets = `${args.assetsAbs}.pull-${randomBytes(8).toString("hex")}`;
  let downloadedCount = 0;
  let skippedCount = 0;

  try {
    await fs.mkdir(tmpAssets, { recursive: true });

    for (const file of args.files) {
      const relativePath = safeAssetPath(file.path);
      if (relativePath === undefined) {
        skippedCount++;
        continue;
      }

      const dest = join(tmpAssets, relativePath);
      await fs.mkdir(dirname(dest), { recursive: true });
      const result = await fetchSignedUrl(
        { url: file.signedUrl, dest },
        { fetch: deps.fetch, fs },
      );
      if (!result.ok) {
        throw new Error(
          describeTeamStorageDownloadError(file.path, result.error),
        );
      }
      downloadedCount++;
    }

    await replaceAssetsDir(args.assetsAbs, tmpAssets, fs);
    return { downloadedCount, skippedCount };
  } catch (error: unknown) {
    await fs.rm(tmpAssets, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function replaceAssetsDir(
  assetsAbs: string,
  tmpAssets: string,
  fs: Fs,
): Promise<void> {
  const oldAssets = `${assetsAbs}.old-${randomBytes(8).toString("hex")}`;
  let movedOldAssets = false;

  try {
    if (await fs.pathExists(assetsAbs)) {
      await fs.rename(assetsAbs, oldAssets);
      movedOldAssets = true;
    }
    await fs.rename(tmpAssets, assetsAbs);
  } catch (error: unknown) {
    if (movedOldAssets) {
      await fs.rename(oldAssets, assetsAbs).catch(() => {});
    }
    throw error;
  }

  if (movedOldAssets) {
    await fs.rm(oldAssets, { recursive: true, force: true });
  }
}

function safeAssetPath(path: string): string | undefined {
  if (
    !path ||
    path.endsWith("/") ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.includes(":") ||
    isAbsolute(path)
  ) {
    return undefined;
  }

  const segments = path.split("/");
  if (segments.some(isUnsafeSegment)) return undefined;

  const normalized = normalize(path);
  if (normalized.startsWith(`..${sep}`) || normalized === "..") {
    return undefined;
  }
  return normalized;
}

function isUnsafeSegment(segment: string): boolean {
  const normalized = segment.toLowerCase();
  return (
    segment === "" ||
    segment === "." ||
    segment === ".." ||
    normalized === "_screenshots_" ||
    normalized === "screenshots" ||
    normalized === "ovpn" ||
    normalized.endsWith(".ovpn")
  );
}
