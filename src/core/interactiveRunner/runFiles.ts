import {
  type RunFiles,
  maxRunFilesByteLength,
  maxRunnerRequestEncodedByteLength,
  runFilesByteLength,
  runPackageJsonPath,
} from "@qawolf/api-contracts/v1";

/**
 * The rules `runner.runFlow` refuses a request for, checked here so a caller is
 * told what to fix instead of being handed a schema error.
 *
 * Every rule comes from the published contract rather than being restated: the
 * server validates with the same predicate, the same caps and the same required
 * path.
 *
 * The encoded cap is the one check that is an estimate. The server applies it to
 * the fully assembled request, which carries transport framing the CLI does not
 * reproduce, so this measures the request body alone. It therefore catches the
 * overage a caller can act on — one large file — and can still let a request
 * through that the server refuses by a margin.
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
    }
  | {
      type: "request-too-large";
      byteLength: number;
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

  const encodedByteLength = Buffer.byteLength(
    JSON.stringify({ entryPointPath, files }),
    "utf8",
  );
  if (encodedByteLength > maxRunnerRequestEncodedByteLength) {
    return {
      byteLength: encodedByteLength,
      maxByteLength: maxRunnerRequestEncodedByteLength,
      type: "request-too-large",
    };
  }
  return { type: "ok" };
}
