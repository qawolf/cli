import type {
  ArtifactFailure,
  RangeReader,
} from "~/domains/investigation/types.js";

import { isReadFailure, readSafeUint64, viewOf } from "./zipRangeReader.js";

export type CentralDirectoryLocation = {
  entryCount: number;
  offset: number;
  size: number;
};

export type RecordCandidate = {
  classic: CentralDirectoryLocation;
  recordPosition: number;
};

const recordSignature = 0x06054b50;
const recordSize = 22;
const maxCommentSize = 0xffff;
/** Covers the record without a long comment, so most zips need one small read. */
const shortTailSize = 1024;
/** Real zips hold one end record, so a few covers signatures in a comment without letting a crafted comment force a directory read per signature. */
const maxCandidates = 4;
const zip64LocatorSignature = 0x07064b50;
const zip64LocatorSize = 20;
const zip64RecordSignature = 0x06064b50;
const zip64RecordSize = 56;

function findRecords(tail: Uint8Array): number[] {
  const view = viewOf(tail);
  const positions = Array.from(
    { length: Math.max(0, tail.length - recordSize + 1) },
    (_, index) => tail.length - recordSize - index,
  );
  return positions.filter(
    (position) =>
      view.getUint32(position, true) === recordSignature &&
      position + recordSize + view.getUint16(position + 20, true) ===
        tail.length,
  );
}

function checked(
  location: CentralDirectoryLocation,
  directoryEnd: number,
): CentralDirectoryLocation | "malformed" {
  return location.offset + location.size <= directoryEnd
    ? location
    : "malformed";
}

async function readZip64Location(
  readRange: RangeReader,
  recordPosition: number,
): Promise<CentralDirectoryLocation | ArtifactFailure | "malformed"> {
  const locatorPosition = recordPosition - zip64LocatorSize;
  if (locatorPosition < 0) return "malformed";
  const locatorBytes = await readRange(locatorPosition, zip64LocatorSize);
  if (isReadFailure(locatorBytes)) return locatorBytes;
  const locator = viewOf(locatorBytes);
  if (locator.getUint32(0, true) !== zip64LocatorSignature) return "malformed";
  const zip64Position = readSafeUint64(locator, 8);
  if (zip64Position === undefined || zip64Position > locatorPosition)
    return "malformed";
  const recordBytes = await readRange(
    zip64Position,
    Math.min(zip64RecordSize, locatorPosition - zip64Position),
  );
  if (isReadFailure(recordBytes)) return recordBytes;
  const record = viewOf(recordBytes);
  if (
    record.byteLength < zip64RecordSize ||
    record.getUint32(0, true) !== zip64RecordSignature
  )
    return "malformed";
  const entryCount = readSafeUint64(record, 32);
  const size = readSafeUint64(record, 40);
  const offset = readSafeUint64(record, 48);
  if (entryCount === undefined || size === undefined || offset === undefined)
    return "malformed";
  return checked({ entryCount, offset, size }, zip64Position);
}

/** Where `candidate` says the central directory is, following zip64 records when the classic fields are saturated. */
export function readCentralDirectoryLocation(
  readRange: RangeReader,
  { classic, recordPosition }: RecordCandidate,
): Promise<CentralDirectoryLocation | ArtifactFailure | "malformed"> {
  const saturated =
    classic.entryCount === 0xffff ||
    classic.size === 0xffffffff ||
    classic.offset === 0xffffffff;
  return saturated
    ? readZip64Location(readRange, recordPosition)
    : Promise.resolve(checked(classic, recordPosition));
}

async function readTail(
  readRange: RangeReader,
  sizeBytes: number,
  tailLength: number,
): Promise<RecordCandidate[] | ArtifactFailure> {
  const tailStart = sizeBytes - tailLength;
  const tail = await readRange(tailStart, tailLength);
  if (isReadFailure(tail)) return tail;
  const view = viewOf(tail);
  return findRecords(tail).map((position) => ({
    classic: {
      entryCount: view.getUint16(position + 10, true),
      offset: view.getUint32(position + 16, true),
      size: view.getUint32(position + 12, true),
    },
    recordPosition: tailStart + position,
  }));
}

/**
 * Up to `maxCandidates` end record candidates from the end of the zip backward, since a comment
 * can hold the signature too. Reads the long-comment tail only when the candidates near the end are used up.
 */
export async function* endRecordCandidates(
  readRange: RangeReader,
  sizeBytes: number,
): AsyncGenerator<RecordCandidate | ArtifactFailure> {
  if (sizeBytes < recordSize) return;
  const shortTail = Math.min(sizeBytes, shortTailSize);
  const nearEnd = await readTail(readRange, sizeBytes, shortTail);
  if (isReadFailure(nearEnd)) {
    yield nearEnd;
    return;
  }
  yield* nearEnd.slice(0, maxCandidates);
  const fullTail = Math.min(sizeBytes, recordSize + maxCommentSize);
  if (fullTail <= shortTail || nearEnd.length >= maxCandidates) return;
  const farther = await readTail(readRange, sizeBytes, fullTail);
  if (isReadFailure(farther)) {
    yield farther;
    return;
  }
  yield* farther
    .filter(({ recordPosition }) => recordPosition < sizeBytes - shortTail)
    .slice(0, maxCandidates - nearEnd.length);
}
