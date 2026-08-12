import type { RunFiles } from "@qawolf/api-contracts/v1";

import { errorMessage } from "~/core/errors.js";
import type { checkRunFiles } from "~/core/interactiveRunner/runFiles.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";

import type { InteractiveRunnerDeps } from "./deps.js";

/** What to tell a caller about files a run cannot ship. */
export function describeRunFilesCheck(
  check: Exclude<ReturnType<typeof checkRunFiles>, { type: "ok" }>,
): string {
  switch (check.type) {
    case "missing-entry-point":
      return interactiveRunnerMessages.entryPointNotCollected(
        check.entryPointPath,
      );
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

/**
 * Every shippable file under the working directory is read, so any one of them
 * being unreadable stops the run — a file the current user cannot open, or one
 * deleted mid-walk. Caught here rather than left to the catch-all, which exits 1
 * and tells CI the flow failed.
 */
export async function collectRunFiles(
  deps: InteractiveRunnerDeps,
): Promise<{ ok: true; files: RunFiles } | { ok: false; error: string }> {
  try {
    return { files: await deps.collectRunFiles(), ok: true };
  } catch (error) {
    const path = readErrorPath(error);
    return {
      error:
        path === undefined
          ? interactiveRunnerMessages.filesUnreadable(errorMessage(error))
          : interactiveRunnerMessages.fileUnreadable(path, errorMessage(error)),
      ok: false,
    };
  }
}

/** Node puts the offending path on a filesystem error; naming it saves a hunt. */
function readErrorPath(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const path = (error as { path?: unknown }).path;
  return typeof path === "string" ? path : undefined;
}
