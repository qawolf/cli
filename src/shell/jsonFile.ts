import type { z } from "zod";

import { parseJson } from "~/core/parseJson.js";
import type { Fs } from "~/shell/fs.js";

// Unique per write within this process: two commands writing at once must not
// share a temp file, or one rename pulls the other's out from under it.
let pendingWrites = 0;

/**
 * A JSON file read through a schema. Missing, unreadable, malformed and
 * wrong-shaped all read as absent, which is what every store here wants: a
 * stale or torn file is worth exactly as much as no file.
 */
export async function readJsonFile<Schema extends z.ZodType>(
  fs: Fs,
  path: string,
  schema: Schema,
): Promise<z.output<Schema> | undefined> {
  const contents = await fs.readFile(path).catch(() => undefined);
  if (contents === undefined) return undefined;
  const parsed = schema.safeParse(parseJson(contents));
  return parsed.success ? parsed.data : undefined;
}

/**
 * Writes JSON beside the target and renames it into place, so a reader never
 * sees half a record. The directory is the caller's to create.
 */
export async function writeJsonFileAtomically(
  fs: Fs,
  path: string,
  value: unknown,
): Promise<void> {
  const pendingPath = `${path}.${String(process.pid)}.${String(++pendingWrites)}.tmp`;
  await fs.writeFile(pendingPath, `${JSON.stringify(value, undefined, 2)}\n`);
  await fs.rename(pendingPath, path);
}
