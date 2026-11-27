import type {
  ArtifactFailure,
  RangeReader,
} from "~/domains/investigation/types.js";

import { readCentralDirectory } from "./readCentralDirectory.js";
import type { ZipEntry } from "./zipCentralDirectory.js";
import { type EntryRead, readZipEntry } from "./zipEntryRead.js";
import { budgetedReader, isReadFailure } from "./zipRangeReader.js";

export type RangedZipLimits = {
  /** Bytes read to find and read the central directory, across every end record tried. */
  maxDirectoryBytes: number;
  maxEntries: number;
  /** Bytes fetched from storage for the whole archive, directory and entries together. */
  maxFetchedBytes: number;
  rangeBytes: number;
};

export const rangedZipLimits: RangedZipLimits = {
  maxDirectoryBytes: 16 * 1024 * 1024,
  maxEntries: 200_000,
  maxFetchedBytes: 75 * 1024 * 1024,
  rangeBytes: 4 * 1024 * 1024,
};

export type RangedZip = {
  entries: ZipEntry[];
  read: (
    entry: ZipEntry,
    limit: number,
  ) => Promise<EntryRead | ArtifactFailure>;
};

/**
 * Reads a zip's central directory with range reads, following zip64 records, so its entries
 * can be read one at a time without downloading the whole file.
 */
export async function openRangedZip({
  limits,
  readRange,
  sizeBytes,
}: {
  limits: RangedZipLimits;
  readRange: RangeReader;
  sizeBytes: number;
}): Promise<RangedZip | ArtifactFailure | "malformed"> {
  const fetched = budgetedReader(readRange, limits.maxFetchedBytes);
  const directory = await readCentralDirectory({
    fitsLimit: ({ entryCount, size }) =>
      entryCount <= limits.maxEntries &&
      fetched.bytesRead() + size <= limits.maxDirectoryBytes,
    readRange: fetched.readRange,
    sizeBytes,
  });
  if (directory === "malformed" || isReadFailure(directory)) return directory;
  return {
    entries: directory.entries,
    read: (entry, limit) =>
      readZipEntry({
        dataEnd: directory.location.offset,
        entry,
        limit,
        rangeBytes: limits.rangeBytes,
        readRange: fetched.readRange,
      }),
  };
}
