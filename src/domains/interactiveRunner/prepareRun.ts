import type { RunFiles, RunSelection } from "@qawolf/api-contracts/v1";
import { resolve } from "node:path";

import { buildRunSelection } from "~/core/interactiveRunner/lineSelection.js";
import {
  type BuiltRunEnvironment,
  buildRunEnvironment,
} from "~/core/interactiveRunner/runEnvironment.js";
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
  | {
      ok: true;
      environment: Record<string, string> | undefined;
      files: RunFiles;
      selection: RunSelection | undefined;
    }
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
    envFile: string | undefined;
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

  const environment = await readEnvironment(options.envFile, deps);
  if (environment !== undefined && !environment.ok) {
    return refused(environment.error, exitCodes.config);
  }
  const given = environment?.ok === true ? environment.environment : undefined;

  if (options.lines === undefined) {
    return options.linesFile === undefined
      ? { environment: given, files, ok: true, selection: undefined }
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
    ? { environment: given, files, ok: true, selection: built.selection }
    : refused(built.error, exitCodes.invalidArgs);
}

async function readEnvironment(
  envFile: string | undefined,
  deps: InteractiveRunnerDeps,
): Promise<BuiltRunEnvironment | undefined> {
  if (envFile === undefined) return undefined;
  const content = await deps
    .readFile(resolve(deps.cwd, envFile))
    .catch(() => undefined);
  return content === undefined
    ? { error: interactiveRunnerMessages.envFileUnreadable(envFile), ok: false }
    : buildRunEnvironment(content);
}
