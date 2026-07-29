import {
  type RunFile,
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
  | { type: "too-large"; byteLength: number; maxByteLength: number };

export function checkRunFiles(
  files: readonly RunFile[],
  entryPointPath: string,
): RunFilesCheck {
  if (!files.some((file) => file.path === entryPointPath)) {
    return { entryPointPath, type: "missing-entry-point" };
  }
  if (!files.some((file) => file.path === runPackageJsonPath)) {
    return { type: "missing-package-json" };
  }
  const byteLength = runFilesByteLength(files);
  if (byteLength > maxRunFilesByteLength) {
    return {
      byteLength,
      maxByteLength: maxRunFilesByteLength,
      type: "too-large",
    };
  }
  return { type: "ok" };
}
