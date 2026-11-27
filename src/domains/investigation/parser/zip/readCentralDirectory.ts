import type {
  ArtifactFailure,
  RangeReader,
} from "~/domains/investigation/types.js";

import { type ZipEntry, parseCentralDirectory } from "./zipCentralDirectory.js";
import {
  type CentralDirectoryLocation,
  type RecordCandidate,
  endRecordCandidates,
  readCentralDirectoryLocation,
} from "./zipEndOfCentralDirectory.js";
import { isReadFailure } from "./zipRangeReader.js";

type CentralDirectory = {
  entries: ZipEntry[];
  location: CentralDirectoryLocation;
};

type DirectoryResult = CentralDirectory | ArtifactFailure | "malformed";

type DirectoryReading = {
  /** False when the directory at `location` is over the caller's budget, so that candidate is passed over unread. */
  fitsLimit: (location: CentralDirectoryLocation) => boolean;
  readRange: RangeReader;
};

async function readDirectoryAt(
  { fitsLimit, readRange }: DirectoryReading,
  candidate: RecordCandidate,
): Promise<DirectoryResult> {
  const location = await readCentralDirectoryLocation(readRange, candidate);
  if (location === "malformed" || isReadFailure(location)) return location;
  if (!fitsLimit(location)) return { status: "too-large" };
  const directory = await readRange(location.offset, location.size);
  if (isReadFailure(directory)) return directory;
  const entries = parseCentralDirectory({
    bytes: directory,
    directoryOffset: location.offset,
    entryCount: location.entryCount,
  });
  return entries === "malformed" ? entries : { entries, location };
}

/**
 * Finds and parses the central directory from the end of the zip, passing over end record
 * candidates (such as one inside the zip comment) whose directory isn't valid or is over the budget.
 * A failed read ends the search with that failure; "too-large" when no candidate is valid and one was over the budget.
 */
export async function readCentralDirectory({
  sizeBytes,
  ...reading
}: DirectoryReading & { sizeBytes: number }): Promise<DirectoryResult> {
  let passedOverTooLarge = false;
  for await (const candidate of endRecordCandidates(
    reading.readRange,
    sizeBytes,
  )) {
    if (isReadFailure(candidate)) return candidate;
    const result = await readDirectoryAt(reading, candidate);
    if (result === "malformed") continue;
    if (!isReadFailure(result) || result.status !== "too-large") return result;
    passedOverTooLarge = true;
  }
  return passedOverTooLarge ? { status: "too-large" } : "malformed";
}
