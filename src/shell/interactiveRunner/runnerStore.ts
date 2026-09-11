import { join } from "node:path";
import { z } from "zod";

import { parseJson } from "~/core/parseJson.js";
import { qawolfDir } from "~/core/paths.js";
import type { Fs } from "~/shell/fs.js";
import { readJsonFile, writeJsonFileAtomically } from "~/shell/jsonFile.js";

/**
 * The runners a workspace has launched, and which one its commands go back to
 * when no flag and no environment variable names one.
 *
 * In the workspace rather than the user's config directory, because a runner is
 * bound to the project whose files it has been running: two checkouts driven
 * side by side must not silently share one browser.
 */
const storeFileName = "runner.json";
const runnersDirName = "runners";

const storedRunnerSchema = z.object({
  id: z.string(),
  runnerName: z.string().optional(),
});

const storeSchema = z.object({
  defaultRunnerId: z.string().optional(),
});

type StoredRunner = z.output<typeof storedRunnerSchema>;

export type RunnerStore = {
  forgetRunner: (runnerId: string) => Promise<void>;
  readDefaultRunnerId: () => Promise<string | undefined>;
  readRunners: () => Promise<StoredRunner[]>;
  rememberLaunch: (runner: StoredRunner) => Promise<void>;
  dropRunners: (runnerIds: readonly string[]) => Promise<void>;
  writeDefaultRunnerId: (runnerId: string) => Promise<void>;
};

export function makeRunnerStore(options: { cwd: string; fs: Fs }): RunnerStore {
  const directory = join(options.cwd, qawolfDir);
  const path = join(directory, storeFileName);
  const runnersDir = join(directory, runnersDirName);

  const runnerPath = (runnerId: string) =>
    join(runnersDir, `${encodeURIComponent(runnerId)}.json`);

  const writeAtomically = (target: string, contents: unknown) =>
    writeJsonFileAtomically(options.fs, target, contents);

  const readDefaultRunnerId = async (): Promise<string | undefined> => {
    const stored = await readJsonFile(options.fs, path, storeSchema);
    return stored?.defaultRunnerId;
  };

  const writeDefaultRunnerId = async (
    runnerId: string | undefined,
  ): Promise<void> => {
    await options.fs.mkdir(directory, { recursive: true });
    await writeAtomically(path, { defaultRunnerId: runnerId });
  };

  const readRunnerFileNames = async (): Promise<string[]> => {
    try {
      const names = await options.fs.readdir(runnersDir);
      return names.filter((name) => name.endsWith(".json"));
    } catch {
      return [];
    }
  };

  return {
    async forgetRunner(runnerId) {
      await options.fs.rm(runnerPath(runnerId), { force: true });
      if ((await readDefaultRunnerId()) === runnerId)
        await writeDefaultRunnerId(undefined);
    },

    readDefaultRunnerId,

    async readRunners() {
      const runners = await Promise.all(
        (await readRunnerFileNames()).map((name) =>
          readJsonFile(options.fs, join(runnersDir, name), storedRunnerSchema),
        ),
      );
      return runners
        .filter((runner): runner is StoredRunner => !!runner)
        .sort((left, right) => left.id.localeCompare(right.id));
    },

    async rememberLaunch(runner) {
      await options.fs.mkdir(runnersDir, { recursive: true });
      await writeAtomically(runnerPath(runner.id), runner);
      await writeDefaultRunnerId(runner.id);
    },

    async dropRunners(runnerIds) {
      await Promise.all(
        runnerIds.map((runnerId) =>
          options.fs.rm(runnerPath(runnerId), { force: true }),
        ),
      );
      const names = await readRunnerFileNames();
      await Promise.all(
        names.map(async (name) => {
          // Unreadable is not malformed: a file that could not be read this
          // once may be a good record, and pruning is the one place a wrong
          // guess destroys one.
          const runnerFile = join(runnersDir, name);
          const contents = await options.fs
            .readFile(runnerFile)
            .catch(() => undefined);
          if (contents === undefined) return;
          if (storedRunnerSchema.safeParse(parseJson(contents)).success) return;
          await options.fs.rm(runnerFile, { force: true });
        }),
      );
    },

    async writeDefaultRunnerId(runnerId) {
      await writeDefaultRunnerId(runnerId);
    },
  };
}
