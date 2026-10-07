export type FileAssetCategory = "file-asset" | "mobile-input";

// Doctor checks file-backed inputs; missing-variable warnings exclude them.
export const fileAssetVarPatterns: readonly {
  readonly pattern: string;
  readonly category: FileAssetCategory;
}[] = [
  { pattern: "TEAM_STORAGE_DIR", category: "file-asset" },
  { pattern: "QAWOLF_*_DIR", category: "file-asset" },
  { pattern: "RUN_*_DIR", category: "mobile-input" },
  { pattern: "RUN_INPUT_PATH", category: "mobile-input" },
];

/** A pattern's `*` as a regular expression: one or more word characters. */
export const expandEnvVarPattern = (pattern: string): string =>
  pattern.replace(/\*/g, "\\w+");

// Runtime settings are intentionally excluded from missing-variable warnings;
// their absence from a pulled .env does not imply a missing flow credential.
const runtimeProvidedNames = new Set([
  // OS paths and conventional process controls; not guaranteed to be set.
  "HOME",
  "PATH",
  "PWD",
  "TMPDIR",
  "TEMP",
  "TMP",
  "NODE_ENV",
  "CI",
]);

const runtimeProvidedPatterns = [
  /^QAWOLF_/,
  /^PW_/,
  /^PLAYWRIGHT_/,
  ...fileAssetVarPatterns.map(
    ({ pattern }) => new RegExp(`^${expandEnvVarPattern(pattern)}$`),
  ),
];

export function isRuntimeProvidedEnvVar(name: string): boolean {
  return (
    runtimeProvidedNames.has(name) ||
    runtimeProvidedPatterns.some((pattern) => pattern.test(name))
  );
}
