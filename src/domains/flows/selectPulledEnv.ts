import { findPulledEnvDir } from "~/core/repoRelativePath.js";
import { flowsMessages } from "~/core/messages/index.js";
import { suggestNearMiss } from "~/core/suggestNearMiss.js";
import type { CommandResult } from "~/shell/commandContext.js";
import { exitCodes } from "~/shell/exit.js";

export type PulledEnvSelection =
  | { kind: "selected"; files: string[] }
  | { kind: "unknown"; result: CommandResult };

/**
 * Narrows a listing to one pulled environment, named by id, slug, or name.
 *
 * Answered entirely from disk: `--env` without `--remote` refers to something
 * already pulled, so it needs no auth and the error can name what is here.
 */
export async function selectPulledEnv(args: {
  readonly files: readonly string[];
  readonly ref: string;
  readonly findPulledEnv: (
    ref: string,
  ) => Promise<{ dir: string; envId: string } | undefined>;
  /** Every pulled env dir on disk, not just those the pattern matched. */
  readonly listPulledEnvDirs: () => Promise<string[]>;
  readonly readEnvLabel: (envDir: string) => Promise<string>;
}): Promise<PulledEnvSelection> {
  const found = await args.findPulledEnv(args.ref);
  if (found !== undefined) {
    return {
      kind: "selected",
      files: args.files.filter((file) => findPulledEnvDir(file) === found.dir),
    };
  }

  // The pattern may have matched no files from a pulled env, so the error
  // lists what is on disk rather than what happened to match.
  const dirs = await args.listPulledEnvDirs();
  const labels = (
    await Promise.all(dirs.map((dir) => args.readEnvLabel(dir)))
  ).sort();
  return {
    kind: "unknown",
    result: {
      error: flowsMessages.selectors.unknownPulledEnv(
        args.ref,
        labels,
        suggestNearMiss(args.ref, labels),
      ),
      exitCode: exitCodes.invalidArgs,
    },
  };
}
