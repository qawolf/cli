import { join } from "node:path";
import { z } from "zod";

import type { RunFilesManifest } from "~/core/interactiveRunner/fileDelta.js";
import { qawolfDir } from "~/core/paths.js";
import type { Fs } from "~/shell/fs.js";

/**
 * A sibling of `runner.json`, not a field in it. `clearDefaultRunnerId` removes
 * that whole file, so a `runner terminate` would take the baseline with it and
 * the next run would ship everything without knowing why.
 */
const manifestFileName = "runner-files.json";

const manifestSchema = z.object({
  files: z.array(z.object({ contentHash: z.string(), path: z.string() })),
  runnerId: z.string(),
  version: z.literal(1),
});

export type RunFilesManifestStore = {
  read: () => Promise<RunFilesManifest | undefined>;
  write: (manifest: RunFilesManifest) => Promise<void>;
};

export function makeRunFilesManifestStore(options: {
  cwd: string;
  fs: Fs;
}): RunFilesManifestStore {
  const directory = join(options.cwd, qawolfDir);
  const path = join(directory, manifestFileName);
  let pendingWrites = 0;

  return {
    // Unparseable reads as absent, because falling back to the whole file set is
    // always correct and refusing to run over a stale cache file never is.
    async read() {
      const contents = await options.fs.readFile(path).catch(() => undefined);
      if (contents === undefined) return undefined;
      const parsed = manifestSchema.safeParse(parseJson(contents));
      return parsed.success ? parsed.data : undefined;
    },

    async write(manifest) {
      const pendingPath = `${path}.${String(process.pid)}.${String(++pendingWrites)}.tmp`;
      await options.fs.mkdir(directory, { recursive: true });
      await options.fs.writeFile(
        pendingPath,
        `${JSON.stringify(manifest, undefined, 2)}\n`,
      );
      await options.fs.rename(pendingPath, path);
    },
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
