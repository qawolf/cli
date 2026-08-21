import type { RunFiles, RunSelection } from "@qawolf/api-contracts/v1";

import { buildRunSelection } from "~/core/interactiveRunner/lineSelection.js";
import {
  checkRunFiles,
  describeRunFilesCheck,
  toCollectedPath,
} from "~/core/interactiveRunner/runFiles.js";
import { interactiveRunnerMessages } from "~/core/messages/index.js";
import { exitCodes } from "~/shell/exit.js";

import { collectRunFiles } from "./collectFiles.js";
import type { InteractiveRunnerDeps } from "./deps.js";

export type PreparedRun =
  | { ok: true; files: RunFiles; selection: RunSelection | undefined }
  | { ok: false; error: string; exitCode: number };

const refused = (error: string, exitCode: number): PreparedRun => ({
  error,
  exitCode,
  ok: false,
});

/**
 * Everything a run needs off disk, gathered before a runner is resolved so a
 * misspelled flow name is not answered with a billed pod. A selection naming a
 * path the request does not carry is caught here, where the path can be named,
 * rather than coming back as a schema error.
 */
export async function prepareRun(
  options: {
    entryPointPath: string;
    lines: string | undefined;
    linesFile: string | undefined;
  },
  deps: InteractiveRunnerDeps,
): Promise<PreparedRun> {
  const collected = await collectRunFiles(deps);
  if (!collected.ok) return refused(collected.error, exitCodes.config);

  const files = collected.files;
  const check = checkRunFiles(files, options.entryPointPath);
  if (check.type !== "ok") {
    return refused(describeRunFilesCheck(check), exitCodes.invalidArgs);
  }

  if (options.lines === undefined) {
    return options.linesFile === undefined
      ? { files, ok: true, selection: undefined }
      : refused(
          interactiveRunnerMessages.linesFileWithoutLines,
          exitCodes.invalidArgs,
        );
  }

  const path =
    options.linesFile === undefined
      ? options.entryPointPath
      : toCollectedPath(deps.cwd, options.linesFile);
  if (!Object.hasOwn(files, path)) {
    return refused(
      interactiveRunnerMessages.fileNotCollected(path),
      exitCodes.invalidArgs,
    );
  }

  const built = buildRunSelection({ lines: options.lines, path });
  return built.ok
    ? { files, ok: true, selection: built.selection }
    : refused(built.error, exitCodes.invalidArgs);
}
