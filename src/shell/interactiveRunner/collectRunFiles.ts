import {
  type RunFile,
  isShippableRunFilePath,
  shippableRunFileExtensions,
} from "@qawolf/api-contracts/v1";
import { join } from "node:path";
import { glob } from "tinyglobby";

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
  return Promise.all(
    shippable.map(async (path) => ({
      content: await options.fs.readFile(join(options.cwd, path)),
      path,
    })),
  );
}
