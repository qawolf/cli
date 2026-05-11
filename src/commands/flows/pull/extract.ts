import { createReadStream, mkdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createGunzip } from "node:zlib";
import { Parser, type ReadEntry } from "tar";

import { validateEntryPath } from "./entryPath.js";

const defaultMaxEntryBytes = 50 * 1024 * 1024;
const defaultMaxTotalBytes = 500 * 1024 * 1024;

type ExtractOptions = {
  readonly maxEntryBytes?: number;
  readonly maxTotalBytes?: number;
};

/**
 * Extract a gzipped tar archive into `destDir`.
 *
 * Precondition: `destDir` must be a freshly created empty directory.
 * Pre-existing symlinks beneath `destDir` would let archive entries escape
 * the destination via symlink traversal; callers must guarantee no such
 * symlinks exist before invoking (e.g. by using a freshly-minted temp dir).
 */
export async function extractTarGz(
  tgzPath: string,
  destDir: string,
  opts: ExtractOptions = {},
): Promise<void> {
  const maxEntryBytes = opts.maxEntryBytes ?? defaultMaxEntryBytes;
  const maxTotalBytes = opts.maxTotalBytes ?? defaultMaxTotalBytes;
  await mkdir(destDir, { recursive: true });
  const destResolved = resolve(destDir);

  return new Promise<void>((resolveOuter, rejectOuter) => {
    let total = 0;
    let aborted = false;
    const pending: Promise<void>[] = [];

    const rs = createReadStream(tgzPath);
    const gz = createGunzip();
    const parser = new Parser({ strict: true });

    const abort = (err: Error): void => {
      if (aborted) return;
      aborted = true;
      rs.destroy();
      gz.destroy();
      parser.end();
      rejectOuter(err);
    };

    parser.on("entry", (entry: ReadEntry) => {
      if (aborted) {
        entry.resume();
        return;
      }
      const p = handleEntry({
        entry,
        destResolved,
        maxEntryBytes,
        maxTotalBytes,
        addTotal: (n) => (total += n),
        getTotal: () => total,
      }).catch((err: unknown) => {
        abort(err instanceof Error ? err : new Error(String(err)));
      });
      pending.push(p);
    });

    parser.on("error", abort);
    parser.on("end", () => {
      // Parser only signals bytes consumed; entry handlers may still be
      // writing to disk. Wait for them before resolving.
      Promise.all(pending).then(() => {
        if (!aborted) resolveOuter();
      }, abort);
    });

    rs.on("error", abort);
    gz.on("error", abort);
    rs.pipe(gz).pipe(parser);
  });
}

type HandleArgs = {
  entry: ReadEntry;
  destResolved: string;
  maxEntryBytes: number;
  maxTotalBytes: number;
  getTotal: () => number;
  addTotal: (n: number) => number;
};

async function handleEntry(args: HandleArgs): Promise<void> {
  const { entry, destResolved, maxEntryBytes, maxTotalBytes } = args;
  const target = validateEntryPath(entry.path, destResolved);

  if (entry.type === "SymbolicLink" || entry.type === "Link") {
    entry.resume();
    throw new Error(`symlink entry rejected: ${entry.path}`);
  }
  if (entry.type === "Directory") {
    await mkdir(target, { recursive: true });
    entry.resume();
    return;
  }

  const size = entry.size ?? 0;
  if (size > maxEntryBytes) {
    entry.resume();
    throw new Error(
      `entry exceeds max size (${entry.path}): ${String(size)} > ${String(maxEntryBytes)}`,
    );
  }
  if (args.getTotal() + size > maxTotalBytes) {
    entry.resume();
    throw new Error(`total uncompressed size exceeds cap`);
  }
  args.addTotal(size);

  // mkdirSync (not async) to keep entry-consumer attachment synchronous.
  // Switching to `await mkdir(...)` lets the parser stream advance before we
  // attach the data handler, dropping entry bytes.
  mkdirSync(dirname(target), { recursive: true });

  // Buffer entry data into memory, then write the file. Atomicity for the
  // bundle as a whole comes from stageBundle's rename-into-place swap, not
  // from this per-entry write. Flow files are small (KB) so the memory cost
  // is bounded by maxEntryBytes.
  const chunks: Buffer[] = [];
  await new Promise<void>((res, rej) => {
    entry.on("data", (chunk: Buffer) => chunks.push(chunk));
    entry.on("error", rej);
    entry.on("end", () => res());
  });

  await writeFile(target, Buffer.concat(chunks));
}
