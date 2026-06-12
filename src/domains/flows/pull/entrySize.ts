import type { ReadEntry } from "tar";

import { flowsMessages } from "~/core/messages/index.js";

type CheckEntrySizeArgs = {
  entry: ReadEntry;
  maxEntryBytes: number;
  maxTotalBytes: number;
  // Bytes accepted so far across previous entries in the archive.
  total: number;
};

/**
 * Validate a tar entry's declared size against the per-entry and total caps.
 * Drains the entry and throws when the size is missing or exceeds a cap — an
 * undefined size would otherwise pass both guards as zero bytes.
 */
export function checkEntrySize(args: CheckEntrySizeArgs): number {
  const { entry, maxEntryBytes, maxTotalBytes, total } = args;
  const size = entry.size;
  if (size === undefined) {
    entry.resume();
    throw new Error(flowsMessages.pull.unknownEntrySize(entry.path));
  }
  if (size > maxEntryBytes) {
    entry.resume();
    throw new Error(
      flowsMessages.pull.entryTooLarge(entry.path, size, maxEntryBytes),
    );
  }
  if (total + size > maxTotalBytes) {
    entry.resume();
    throw new Error(`total uncompressed size exceeds cap`);
  }
  return size;
}
