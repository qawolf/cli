import { join } from "node:path";
import { z } from "zod";

import { qawolfDir } from "~/core/paths.js";
import type { Fs } from "~/shell/fs.js";

/**
 * The runner a workspace goes back to when no flag and no environment variable
 * name one.
 *
 * In the workspace rather than the user's config directory, because a runner is
 * bound to the project whose files it has been running: two checkouts driven
 * side by side must not silently share one browser.
 */
const storeFileName = "runner.json";

const storeSchema = z.object({ defaultRunnerId: z.string().optional() });

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export type RunnerStore = {
  clearDefaultRunnerId: () => Promise<void>;
  readDefaultRunnerId: () => Promise<string | undefined>;
  writeDefaultRunnerId: (runnerId: string) => Promise<void>;
};

export function makeRunnerStore(options: { cwd: string; fs: Fs }): RunnerStore {
  const directory = join(options.cwd, qawolfDir);
  const path = join(directory, storeFileName);
  // Unique per write: two commands writing at once must not share a temp file,
  // or one rename pulls the other's out from under it.
  let pendingWrites = 0;
  const nextPendingPath = () => `${path}.${process.pid}.${++pendingWrites}.tmp`;

  return {
    async clearDefaultRunnerId() {
      await options.fs.rm(path, { force: true });
    },

    async readDefaultRunnerId() {
      // An absent, truncated or hand-edited file means "no default", not a
      // failure: the caller's next step is to launch a runner either way, and
      // refusing to run because of a stale cache file would be the worse answer.
      const contents = await options.fs.readFile(path).catch(() => undefined);
      if (contents === undefined) return undefined;
      const parsed = storeSchema.safeParse(parseJson(contents));
      return parsed.success ? parsed.data.defaultRunnerId : undefined;
    },

    // Written beside the file and renamed over it, so a second invocation
    // reading in the middle of this one sees the old id or the new one and never
    // a half-written file. A file that read as unparseable would read as "no
    // default", and the command that met it would launch and bill a second
    // runner.
    async writeDefaultRunnerId(runnerId) {
      const pendingPath = nextPendingPath();
      await options.fs.mkdir(directory, { recursive: true });
      await options.fs.writeFile(
        pendingPath,
        `${JSON.stringify({ defaultRunnerId: runnerId }, undefined, 2)}\n`,
      );
      await options.fs.rename(pendingPath, path);
    },
  };
}
