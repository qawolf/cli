import {
  type RunFiles,
  maxRunFilesByteLength,
  maxRunnerRequestEncodedByteLength,
  runFilesByteLength,
  runPackageJsonPath,
} from "@qawolf/api-contracts/v1";

import { isAbsolute, relative, resolve, sep } from "node:path";

import { interactiveRunnerMessages } from "~/core/messages/index.js";

/**
 * The path a file travels under: relative to the directory the files were
 * collected from, with forward slashes whatever the platform's separator is.
 */
export function toCollectedPath(cwd: string, path: string): string {
  const absolute = isAbsolute(path) ? path : resolve(cwd, path);
  return relative(cwd, absolute).split(sep).join("/");
}

/**
 * The rules a request bound for a runner is refused for, checked here so a caller
 * is told what to fix instead of being handed a schema error.
 *
 * Every rule comes from the published contract rather than being restated: the
 * server validates with the same predicate, the same caps and the same required
 * path.
 *
 * The encoded cap is the one check that is an estimate. The server applies it to
 * the fully assembled request, which carries transport framing the CLI does not
 * reproduce, so this measures the files and their path alone. It therefore catches
 * the overage a caller can act on — one large file — and can still let a request
 * through that the server refuses by a margin.
 *
 * Two checks rather than one, because the two verbs demand different things. A
 * run reads its npm dependencies from a shipped `package.json` and so cannot
 * proceed without one; a snippet is evaluated against a page that is already
 * open and installs nothing, so demanding one would refuse requests the server
 * would have accepted.
 */
export type RunFilesCheck =
  | { type: "ok" }
  | { type: "missing-package-json" }
  | { type: "missing-file"; path: string }
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

function checkPresenceAndSize(
  files: RunFiles,
  requiredPath: string,
): RunFilesCheck {
  if (!Object.hasOwn(files, requiredPath)) {
    return { path: requiredPath, type: "missing-file" };
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
    JSON.stringify({ files, path: requiredPath }),
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

export function checkRunFiles(
  files: RunFiles,
  entryPointPath: string,
): RunFilesCheck {
  const present = checkPresenceAndSize(files, entryPointPath);
  if (present.type !== "ok") return present;
  if (!Object.hasOwn(files, runPackageJsonPath)) {
    return { type: "missing-package-json" };
  }
  return { type: "ok" };
}

/** The files a snippet's scope travels as, which need no `package.json`. */
export function checkSnippetFiles(
  files: RunFiles,
  contextFilePath: string,
): RunFilesCheck {
  return checkPresenceAndSize(files, contextFilePath);
}

export function describeRunFilesCheck(
  check: Exclude<RunFilesCheck, { type: "ok" }>,
): string {
  switch (check.type) {
    case "missing-file":
      return interactiveRunnerMessages.fileNotCollected(check.path);
    case "missing-package-json":
      return interactiveRunnerMessages.missingPackageJson;
    case "too-large":
      return interactiveRunnerMessages.filesTooLarge(
        check.byteLength,
        check.maxByteLength,
        check.largest,
      );
    case "request-too-large":
      return interactiveRunnerMessages.requestTooLarge(
        check.byteLength,
        check.maxByteLength,
      );
  }
}
