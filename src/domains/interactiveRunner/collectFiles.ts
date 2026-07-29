import type { RunFiles } from "@qawolf/api-contracts/v1";

import { errorMessage } from "~/core/errors.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";

import type { InteractiveRunnerDeps } from "./deps.js";

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
