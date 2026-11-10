import { join } from "node:path";

import type { Fs } from "./fs.js";

export async function walkFiles(
  dir: string,
  include: (name: string) => boolean,
  fs: Fs,
): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await fs.readdirWithTypes(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory())
      found.push(...(await walkFiles(path, include, fs)));
    else if (entry.isFile() && include(entry.name)) found.push(path);
  }
  return found;
}
