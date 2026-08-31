import { join } from "node:path";
import { z } from "zod";

import { qawolfDir } from "~/core/paths.js";
import type { Fs } from "~/shell/fs.js";

import { makeStoreLock } from "./runnerStoreLock.js";

/**
 * The runners a workspace has launched, and which one its commands go back to
 * when no flag and no environment variable names one.
 *
 * In the workspace rather than the user's config directory, because a runner is
 * bound to the project whose files it has been running: two checkouts driven
 * side by side must not silently share one browser.
 */
const storeFileName = "runner.json";

const storedRunnerSchema = z.object({
  id: z.string(),
  runnerName: z.string().optional(),
});

const storeSchema = z.object({
  defaultRunnerId: z.string().optional(),
  runners: z.array(storedRunnerSchema).optional(),
});

export type StoredRunner = z.output<typeof storedRunnerSchema>;

type StoreContents = {
  defaultRunnerId: string | undefined;
  runners: StoredRunner[];
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export type RunnerStore = {
  forgetRunner: (runnerId: string) => Promise<void>;
  readDefaultRunnerId: () => Promise<string | undefined>;
  readRunners: () => Promise<StoredRunner[]>;
  rememberLaunch: (runner: StoredRunner) => Promise<void>;
  retainRunners: (runnerIds: readonly string[]) => Promise<void>;
  writeDefaultRunnerId: (runnerId: string) => Promise<void>;
};

let pendingWrites = 0;

export function makeRunnerStore(options: { cwd: string; fs: Fs }): RunnerStore {
  const directory = join(options.cwd, qawolfDir);
  const path = join(directory, storeFileName);
  // Unique per write: two commands writing at once must not share a temp file,
  // or one rename pulls the other's out from under it.
  const nextPendingPath = () => `${path}.${process.pid}.${++pendingWrites}.tmp`;

  const withLock = makeStoreLock({
    directory,
    fs: options.fs,
    lockPath: `${path}.lock`,
  });

  const read = async (): Promise<StoreContents> => {
    const contents = await options.fs.readFile(path).catch(() => undefined);
    const parsed =
      contents === undefined
        ? undefined
        : storeSchema.safeParse(parseJson(contents));
    if (!parsed?.success) return { defaultRunnerId: undefined, runners: [] };
    return {
      defaultRunnerId: parsed.data.defaultRunnerId,
      runners: parsed.data.runners ?? [],
    };
  };

  const write = async (contents: StoreContents): Promise<void> => {
    const pendingPath = nextPendingPath();
    await options.fs.mkdir(directory, { recursive: true });
    await options.fs.writeFile(
      pendingPath,
      `${JSON.stringify(contents, undefined, 2)}\n`,
    );
    await options.fs.rename(pendingPath, path);
  };

  const update = async (
    change: (contents: StoreContents) => StoreContents,
  ): Promise<void> => {
    await withLock(async () => write(change(await read())));
  };

  return {
    async forgetRunner(runnerId) {
      await update((contents) => ({
        defaultRunnerId:
          contents.defaultRunnerId === runnerId
            ? undefined
            : contents.defaultRunnerId,
        runners: contents.runners.filter((runner) => runner.id !== runnerId),
      }));
    },

    async readDefaultRunnerId() {
      return (await read()).defaultRunnerId;
    },

    async readRunners() {
      return (await read()).runners;
    },

    async rememberLaunch(runner) {
      await update((contents) => ({
        defaultRunnerId: runner.id,
        runners: [
          ...contents.runners.filter((held) => held.id !== runner.id),
          runner,
        ],
      }));
    },

    async retainRunners(runnerIds) {
      const running = new Set(runnerIds);
      await update((contents) => ({
        ...contents,
        runners: contents.runners.filter((runner) => running.has(runner.id)),
      }));
    },

    async writeDefaultRunnerId(runnerId) {
      await update((contents) => ({ ...contents, defaultRunnerId: runnerId }));
    },
  };
}
