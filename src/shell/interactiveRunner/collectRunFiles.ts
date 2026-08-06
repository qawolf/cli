import {
  type RunFile,
  isShippableRunFilePath,
  shippableRunFileExtensions,
} from "@qawolf/api-contracts/v1";
import { join } from "node:path";
import { glob } from "tinyglobby";

import { batchMap, flowBatchSize } from "~/core/batchMap.js";
import type { Fs } from "~/shell/fs.js";

/**
 * A runner holds no copy of the project, so a run ships what is on disk right
 * now. This walks the working directory and collects everything that travels.
 *
 * `isShippableRunFilePath` decides, not the glob. The glob only narrows what has
 * to be considered, because walking a repository is the slow part and matching an
 * extension is free; every path it yields is then put to the published predicate,
 * which is the same function the server validates the request with. The two can
 * therefore not disagree, and widening the rule on the server needs no change
 * here beyond a dependency bump.
 *
 * The narrowing is not free of consequence in one respect worth stating: the
 * glob's own defaults skip dot-prefixed paths, and so never offer `.env` or
 * `.git` to the predicate. The predicate refuses them as well, so what a run
 * ships today is the same either way, and the pre-filter is what keeps the walk
 * out of `.git` altogether.
 */
export async function collectRunFiles(options: {
  cwd: string;
  fs: Fs;
}): Promise<RunFile[]> {
  const paths = await glob(
    shippableRunFileExtensions.map((extension) => `**/*${extension}`),
    {
      cwd: options.cwd,
      // An installed dependency tree is never shipped, and it is where nearly
      // every matching file in a real project lives; the predicate refuses it
      // too, but only after the walk has already paid for it.
      ignore: ["**/node_modules/**"],
    },
  );

  const shippable = paths.filter(isShippableRunFilePath).sort();

  // In batches rather than all at once: a repository can hold thousands of
  // matching files, and one open descriptor each is how a collection fails with
  // EMFILE instead of a payload.
  const files: RunFile[] = [];
  const read = batchMap(
    shippable,
    async (path) => ({
      content: await options.fs.readFile(join(options.cwd, path)),
      path,
    }),
    flowBatchSize,
  );
  for await (const file of read) files.push(file);
  return files;
}
