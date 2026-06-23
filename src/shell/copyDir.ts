import { cp, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

/**
 * Recursively copies `source` into `destination`, skipping any entry whose
 * basename is in `excludedNames` (matched at every depth — a skipped directory
 * is not descended into). `destination` must already exist. Each top-level entry
 * is copied independently so `destination` may live inside `source` (e.g. a
 * `.qawolf` staging dir) as long as that dir is excluded — a single recursive
 * `cp` would reject with EINVAL when the destination is a subdirectory of source.
 */
export async function copyDirExcluding(
  source: string,
  destination: string,
  excludedNames: ReadonlySet<string>,
): Promise<void> {
  const entries = await readdir(source, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => !excludedNames.has(entry.name))
      .map((entry) =>
        cp(join(source, entry.name), join(destination, entry.name), {
          recursive: true,
          filter: (path) => !excludedNames.has(basename(path)),
        }),
      ),
  );
}
