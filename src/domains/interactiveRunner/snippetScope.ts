import type { RunFiles } from "@qawolf/api-contracts/v1";

import {
  checkSnippetFiles,
  describeRunFilesCheck,
  toCollectedPath,
} from "~/core/interactiveRunner/runFiles.js";

import type { InteractiveRunnerDeps } from "./deps.js";

export type SnippetScope =
  | { ok: true; filePath: string | undefined; files: RunFiles | undefined }
  | { ok: false; error: string };

/**
 * The scope a snippet is evaluated in. A runner holds no copy of the project, so
 * a snippet that touches the caller's own modules has to carry them: the named
 * file and everything the collector found beside it. Without `--file` the snippet
 * imports nothing of the caller's and nothing travels.
 */
export async function resolveSnippetScope(
  contextFile: string | undefined,
  deps: Pick<InteractiveRunnerDeps, "collectRunFiles" | "cwd">,
): Promise<SnippetScope> {
  if (contextFile === undefined) {
    return { filePath: undefined, files: undefined, ok: true };
  }
  const filePath = toCollectedPath(deps.cwd, contextFile);
  const { files } = await deps.collectRunFiles([filePath]);
  const check = checkSnippetFiles(files, filePath);
  if (check.type !== "ok") {
    return { error: describeRunFilesCheck(check), ok: false };
  }
  return { filePath, files, ok: true };
}
