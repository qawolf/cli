import { relative } from "node:path";

import type { CheckResult } from "~/doctor/types.js";
import { errorMessage } from "~/lib/errors.js";

const fileAssetVarRe = /\bQAWOLF_\w+_DIR\b/g;

export const fileAssetsWarnReason =
  "file assets aren't pulled in v0.1; web flows depending on them can't run locally; mobile flows should provide a local path via env var";

type ReadFileFn = (path: string) => Promise<string>;

type FileAssetsDeps = {
  readonly files: readonly string[];
  readonly readFile: ReadFileFn;
  readonly cwd: string;
};

type ScanOutcome =
  | { readonly kind: "scanned"; readonly file: string; readonly vars: string[] }
  | {
      readonly kind: "unreadable";
      readonly file: string;
      readonly message: string;
    };

export function scanFileAssetReferences(source: string): string[] {
  return [...new Set(source.match(fileAssetVarRe) ?? [])];
}

async function scanOne(
  file: string,
  readFile: ReadFileFn,
): Promise<ScanOutcome> {
  try {
    return {
      kind: "scanned",
      file,
      vars: scanFileAssetReferences(await readFile(file)),
    };
  } catch (err) {
    return { kind: "unreadable", file, message: errorMessage(err) };
  }
}

export async function checkFileAssets(
  deps: FileAssetsDeps,
): Promise<CheckResult[]> {
  const outcomes = await Promise.all(
    deps.files.map((file) => scanOne(file, deps.readFile)),
  );
  return outcomes.flatMap((outcome): CheckResult[] => {
    const display = relative(deps.cwd, outcome.file) || outcome.file;
    if (outcome.kind === "unreadable") {
      return [
        {
          name: "file-assets",
          status: "warn",
          detail: `${display} could not be read: ${outcome.message}`,
        },
      ];
    }
    if (outcome.vars.length === 0) return [];
    return [
      {
        name: "file-assets",
        status: "warn",
        detail: `${display} references ${outcome.vars.join(", ")} — ${fileAssetsWarnReason}`,
      },
    ];
  });
}
