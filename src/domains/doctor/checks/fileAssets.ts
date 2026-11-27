import { relative } from "node:path";

import { doctorMessages } from "~/core/messages/index.js";
import {
  expandEnvVarPattern,
  type FileAssetCategory,
  fileAssetVarPatterns,
} from "~/core/runtimeEnvVars.js";
import type { CheckResult } from "~/domains/doctor/types.js";
import { errorMessage } from "~/core/errors.js";

const fileAssetVarRe = new RegExp(
  `\\b(?:${fileAssetVarPatterns.map(({ pattern }) => expandEnvVarPattern(pattern)).join("|")})\\b`,
  "g",
);

const compiledByCategory = fileAssetVarPatterns.map(
  ({ pattern, category }) => ({
    re: new RegExp(`^${expandEnvVarPattern(pattern)}$`),
    category,
  }),
);

export const fileAssetsWarnReasons = doctorMessages.fileAssets.warnReasons;

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

function categorize(varName: string): FileAssetCategory {
  const hit = compiledByCategory.find(({ re }) => re.test(varName));
  if (!hit)
    throw new Error(doctorMessages.fileAssets.uncategorizedVar(varName));
  return hit.category;
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

function groupByCategory(
  vars: readonly string[],
): Map<FileAssetCategory, string[]> {
  const groups = new Map<FileAssetCategory, string[]>();
  for (const varName of vars) {
    const category = categorize(varName);
    const existing = groups.get(category);
    if (existing) existing.push(varName);
    else groups.set(category, [varName]);
  }
  return groups;
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
          detail: doctorMessages.fileAssets.unreadable(
            display,
            outcome.message,
          ),
        },
      ];
    }
    if (outcome.vars.length === 0) return [];
    return [...groupByCategory(outcome.vars)].map(
      ([category, vars]): CheckResult => ({
        name: "file-assets",
        status: "warn",
        detail: doctorMessages.fileAssets.referencesVars(
          display,
          vars.join(", "),
          fileAssetsWarnReasons[category],
        ),
      }),
    );
  });
}
