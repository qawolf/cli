import { relative } from "node:path";

import type { CheckResult } from "~/doctor/types.js";
import { errorMessage } from "~/core/errors.js";

type FileAssetCategory = "file-asset" | "mobile-input";

const fileAssetVarPatterns: readonly {
  readonly pattern: string;
  readonly category: FileAssetCategory;
}[] = [
  { pattern: "TEAM_STORAGE_DIR", category: "file-asset" },
  { pattern: "QAWOLF_*_DIR", category: "file-asset" },
  { pattern: "RUN_*_DIR", category: "mobile-input" },
  { pattern: "RUN_INPUT_PATH", category: "mobile-input" },
];

const expandPattern = (pattern: string): string =>
  pattern.replace(/\*/g, "\\w+");

const fileAssetVarRe = new RegExp(
  `\\b(?:${fileAssetVarPatterns.map(({ pattern }) => expandPattern(pattern)).join("|")})\\b`,
  "g",
);

const compiledByCategory = fileAssetVarPatterns.map(
  ({ pattern, category }) => ({
    re: new RegExp(`^${expandPattern(pattern)}$`),
    category,
  }),
);

export const fileAssetsWarnReasons: Readonly<
  Record<FileAssetCategory, string>
> = {
  "file-asset":
    "file assets aren't pulled in v0.1; this flow can't run locally",
  "mobile-input":
    "mobile build inputs aren't mounted locally; provide the APK path via a local env var",
};

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
  if (!hit) throw new Error(`uncategorized file-asset var: ${varName}`);
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
          detail: `${display} could not be read: ${outcome.message}`,
        },
      ];
    }
    if (outcome.vars.length === 0) return [];
    return [...groupByCategory(outcome.vars)].map(
      ([category, vars]): CheckResult => ({
        name: "file-assets",
        status: "warn",
        detail: `${display} references ${vars.join(", ")} — ${fileAssetsWarnReasons[category]}`,
      }),
    );
  });
}
