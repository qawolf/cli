import type { CollectedRunFiles } from "~/shell/interactiveRunner/collectRunFiles.js";

import { errorMessage } from "~/core/errors.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";

import type { InteractiveRunnerDeps } from "./deps.js";

/**
 * A file the graph reaches but the current user cannot open, or one deleted
 * mid-walk, stops the run here rather than at the catch-all, which exits 1 and
 * tells CI the flow failed.
 */
export async function collectRunFiles(
  deps: InteractiveRunnerDeps,
  roots: readonly string[],
): Promise<({ ok: true } & CollectedRunFiles) | { ok: false; error: string }> {
  try {
    return { ...(await deps.collectRunFiles(roots)), ok: true };
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
