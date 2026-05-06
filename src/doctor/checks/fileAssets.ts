import { relative } from "node:path";

import type { CheckResult } from "~/doctor/types.js";

const fileAssetVarRe = /\bQAWOLF_\w+_DIR\b/g;

export const fileAssetsWarnReason =
  "file assets aren't pulled in v0.1; web flows depending on them can't run locally; mobile flows should provide a local path via env var";

type ReadFileFn = (path: string) => Promise<string>;

type FileAssetsDeps = {
  readonly files: readonly string[];
  readonly readFile: ReadFileFn;
  readonly cwd: string;
};

export function scanFileAssetReferences(source: string): string[] {
  return [...new Set(source.match(fileAssetVarRe) ?? [])];
}

export async function checkFileAssets(
  deps: FileAssetsDeps,
): Promise<CheckResult[]> {
  const scanned = await Promise.all(
    deps.files.map(async (file) => ({
      file,
      vars: scanFileAssetReferences(await deps.readFile(file)),
    })),
  );
  return scanned
    .filter(({ vars }) => vars.length > 0)
    .map(({ file, vars }): CheckResult => {
      const display = relative(deps.cwd, file) || file;
      return {
        name: "file-assets",
        status: "warn",
        detail: `${display} references ${vars.join(", ")} — ${fileAssetsWarnReason}`,
      };
    });
}
