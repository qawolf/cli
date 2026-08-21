import { type RunFiles, runPackageJsonPath } from "@qawolf/api-contracts/v1";
import { createHash } from "node:crypto";

type RunFileEntry = { contentHash: string; path: string };

export type RunFilesManifest = {
  files: RunFileEntry[];
  runnerId: string;
  version: 1;
};

export type RunFileDelta = {
  files: RunFiles;
  unchangedFiles: Record<string, string> | undefined;
};

/** Matches the platform's `sha256Hex`, so both sides agree on a file's hash. */
export function hashRunFile(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function toRunFilesManifest(options: {
  files: RunFiles;
  runnerId: string;
}): RunFilesManifest {
  return {
    files: Object.entries(options.files)
      .map(([path, content]) => ({ contentHash: hashRunFile(content), path }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    runnerId: options.runnerId,
    version: 1,
  };
}

/**
 * The entry point and `package.json` always travel in full. The server reads an
 * execution target from one and dependencies from the other, and neither can be
 * satisfied from a hash.
 */
export function buildRunFileDelta(options: {
  entryPointPath: string;
  files: RunFiles;
  held: RunFilesManifest | undefined;
  runnerId: string;
}): RunFileDelta {
  const { held } = options;
  if (held === undefined || held.runnerId !== options.runnerId) {
    return { files: options.files, unchangedFiles: undefined };
  }

  const heldHashes = new Map(
    held.files.map((entry) => [entry.path, entry.contentHash]),
  );
  const alwaysSent = new Set([options.entryPointPath, runPackageJsonPath]);

  const files: RunFiles = {};
  const unchangedFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(options.files)) {
    const hash = hashRunFile(content);
    if (!alwaysSent.has(path) && heldHashes.get(path) === hash) {
      unchangedFiles[path] = hash;
      continue;
    }
    files[path] = content;
  }

  return Object.keys(unchangedFiles).length === 0
    ? { files: options.files, unchangedFiles: undefined }
    : { files, unchangedFiles };
}
