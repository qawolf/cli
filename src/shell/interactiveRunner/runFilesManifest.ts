import { join } from "node:path";
import { z } from "zod";

import type { RunFilesManifest } from "~/core/interactiveRunner/fileDelta.js";
import { qawolfDir } from "~/core/paths.js";
import type { Fs } from "~/shell/fs.js";
import { readJsonFile, writeJsonFileAtomically } from "~/shell/jsonFile.js";

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

  return {
    // Unparseable reads as absent, because falling back to the whole file set is
    // always correct and refusing to run over a stale cache file never is.
    read: () => readJsonFile(options.fs, path, manifestSchema),

    async write(manifest) {
      await options.fs.mkdir(directory, { recursive: true });
      await writeJsonFileAtomically(options.fs, path, manifest);
    },
  };
}
