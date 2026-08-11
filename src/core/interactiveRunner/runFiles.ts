import {
  type RunFiles,
  maxRunFilesByteLength,
  runFilesByteLength,
  runPackageJsonPath,
} from "@qawolf/api-contracts/v1";

/**
 * The two rules `runner.runFlow` refuses a request for, checked here so a caller
 * is told what to fix instead of being handed a schema error, plus the size cap.
 *
 * All three come from the published contract rather than being restated: the
 * server validates with the same predicate, the same cap and the same required
 * path, so a request this accepts cannot be one the server turns down for a
 * reason the CLI could have named first.
 */
export type RunFilesCheck =
  | { type: "ok" }
  | { type: "missing-package-json" }
  | { type: "missing-entry-point"; entryPointPath: string }
  | {
      type: "too-large";
      byteLength: number;
      largest: { byteLength: number; path: string }[];
      maxByteLength: number;
    };

/**
 * The few files worth naming when a payload is refused for its size.
 *
 * Named because every source and configuration file under the working directory
 * travels, build output included, and one generated bundle is usually the whole
 * overage. "Your files are too big" leaves a caller guessing at which; naming
 * the largest turns it into a directory to run from or a file to move.
 */
const namedLargestFileCount = 3;

function largestFiles(files: RunFiles): { byteLength: number; path: string }[] {
  return Object.entries(files)
    .map(([path, content]) => ({
      byteLength: runFilesByteLength({ [path]: content }),
      path,
    }))
    .sort((a, b) => b.byteLength - a.byteLength)
    .slice(0, namedLargestFileCount);
}

export function checkRunFiles(
  files: RunFiles,
  entryPointPath: string,
): RunFilesCheck {
  if (!Object.hasOwn(files, entryPointPath)) {
    return { entryPointPath, type: "missing-entry-point" };
  }
  if (!Object.hasOwn(files, runPackageJsonPath)) {
    return { type: "missing-package-json" };
  }
  const byteLength = runFilesByteLength(files);
  if (byteLength > maxRunFilesByteLength) {
    return {
      byteLength,
      largest: largestFiles(files),
      maxByteLength: maxRunFilesByteLength,
      type: "too-large",
    };
  }
  return { type: "ok" };
}
