import { join } from "node:path";

import { z } from "zod";

import { isNoEntError } from "~/core/errors.js";
import { type Fs } from "~/shell/fs.js";

/**
 * qawolf's `#playwright` driver alias, which the platform omits from bundle
 * package.json — pointed at the pinned playwright the inner hop symlinks in.
 */
const flowSubpathImports = { "#playwright": "playwright" } as const;

// looseObject keeps all fields; imports is coerced to a record ({} if missing or malformed).
const packageJsonSchema = z
  .looseObject({ imports: z.record(z.string(), z.unknown()).catch({}) })
  .catch({ imports: {} });

export type WriteExecSubpathImportsArgs = {
  execDir: string;
  fs: Fs;
};

/** Adds the flow subpath-import aliases to exec/package.json's imports map. */
export async function writeExecSubpathImports(
  args: WriteExecSubpathImportsArgs,
): Promise<void> {
  const { execDir, fs } = args;
  const pkgPath = join(execDir, "package.json");
  const pkg = packageJsonSchema.parse(await readPackageJson(pkgPath, fs));

  const merged = { ...pkg, imports: { ...pkg.imports, ...flowSubpathImports } };
  await fs.writeFile(pkgPath, JSON.stringify(merged, undefined, 2));
}

/**
 * Reads and parses pkgPath. A missing file or malformed JSON yields {}; other
 * read errors propagate so a transient failure never clobbers a staged file.
 */
async function readPackageJson(pkgPath: string, fs: Fs): Promise<unknown> {
  let content: string;
  try {
    content = await fs.readFile(pkgPath);
  } catch (err) {
    if (isNoEntError(err)) return {};
    throw err;
  }
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}
