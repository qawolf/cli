import { crc32 } from "node:zlib";

import type {
  ArtifactFailure,
  RangeReader,
} from "~/domains/investigation/types.js";

import { type ZipEntry, localHeaderFixedSize } from "./zipCentralDirectory.js";
import { collect, inflateRaw } from "./zipInflate.js";
import { isReadFailure, viewOf } from "./zipRangeReader.js";

export type EntryRead = {
  bytes: Buffer;
  incomplete: boolean;
  malformed: boolean;
};

const stored = 0;
const deflated = 8;
const localHeaderSignature = 0x04034b50;

export const unreadableEntry: EntryRead = {
  bytes: Buffer.alloc(0),
  incomplete: true,
  malformed: true,
};

function failedRead(failure: ArtifactFailure): EntryRead {
  return failure.status === "too-large"
    ? { bytes: Buffer.alloc(0), incomplete: true, malformed: false }
    : unreadableEntry;
}

/** The most compressed bytes a deflate stream needs for `bytes` of output, with room for block headers. */
function deflateBound(bytes: number): number {
  return bytes + Math.ceil(bytes / 1024) + 1024;
}

async function* rangeChunks(
  readRange: RangeReader,
  {
    length,
    rangeBytes,
    start,
  }: { length: number; rangeBytes: number; start: number },
): AsyncGenerator<Uint8Array | ArtifactFailure> {
  for (let offset = 0; offset < length; offset += rangeBytes) {
    const chunk = await readRange(
      start + offset,
      Math.min(rangeBytes, length - offset),
    );
    yield chunk;
    if (isReadFailure(chunk)) return;
  }
}

async function dataStartOf(
  readRange: RangeReader,
  entry: ZipEntry,
): Promise<number | ArtifactFailure | "corrupt"> {
  const header = await readRange(entry.localHeaderOffset, localHeaderFixedSize);
  if (isReadFailure(header)) return header;
  const view = viewOf(header);
  if (
    view.byteLength < localHeaderFixedSize ||
    view.getUint32(0, true) !== localHeaderSignature
  )
    return "corrupt";
  return (
    entry.localHeaderOffset +
    localHeaderFixedSize +
    view.getUint16(26, true) +
    view.getUint16(28, true)
  );
}

/**
 * Reads up to `limit` uncompressed bytes of an entry. An entry over `limit` comes back as an incomplete prefix;
 * a whole entry must match its declared size and CRC-32. A read over the fetch budget is incomplete, not malformed.
 */
export async function readZipEntry({
  dataEnd,
  entry,
  limit,
  rangeBytes,
  readRange,
}: {
  dataEnd: number;
  entry: ZipEntry;
  limit: number;
  rangeBytes: number;
  readRange: RangeReader;
}): Promise<EntryRead> {
  const deflate = entry.compressionMethod === deflated;
  if (entry.encrypted || (!deflate && entry.compressionMethod !== stored))
    return unreadableEntry;
  if (!deflate && entry.compressedSize !== entry.uncompressedSize)
    return unreadableEntry;
  const whole = entry.uncompressedSize <= limit;
  if (deflate && entry.compressedSize > deflateBound(entry.uncompressedSize))
    return unreadableEntry;
  const dataStart = await dataStartOf(readRange, entry);
  if (dataStart === "corrupt") return unreadableEntry;
  if (typeof dataStart !== "number") return failedRead(dataStart);
  if (dataStart + entry.compressedSize > dataEnd) return unreadableEntry;
  const wanted = Math.min(entry.uncompressedSize, limit);
  const compressed = rangeChunks(readRange, {
    length: deflate
      ? Math.min(entry.compressedSize, deflateBound(wanted))
      : wanted,
    rangeBytes,
    start: dataStart,
  });
  const bytes = await collect(
    deflate ? inflateRaw(compressed) : compressed,
    wanted,
    whole,
  );
  if (bytes === "corrupt") return unreadableEntry;
  if (isReadFailure(bytes)) return failedRead(bytes);
  if (!whole)
    return bytes.byteLength >= limit
      ? { bytes: bytes.subarray(0, limit), incomplete: true, malformed: false }
      : unreadableEntry;
  return bytes.byteLength === entry.uncompressedSize &&
    crc32(bytes) === entry.crc32
    ? { bytes, incomplete: false, malformed: false }
    : unreadableEntry;
}
