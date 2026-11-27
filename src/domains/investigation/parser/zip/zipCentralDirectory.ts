import { readSafeUint64, viewOf } from "./zipRangeReader.js";

export type ZipEntry = {
  compressedSize: number;
  compressionMethod: number;
  /** The CRC-32 of the uncompressed bytes. */
  crc32: number;
  encrypted: boolean;
  localHeaderOffset: number;
  name: string;
  uncompressedSize: number;
};

type Zip64Fields = Pick<
  ZipEntry,
  "compressedSize" | "localHeaderOffset" | "uncompressedSize"
>;

export const localHeaderFixedSize = 30;
const recordSignature = 0x02014b50;
const recordFixedSize = 46;
const saturated = 0xffffffff;
const zip64ExtraId = 0x0001;
const digitalSignatureSignature = 0x05054b50;
const digitalSignatureFixedSize = 6;

function findZip64Extra(extra: DataView): DataView | undefined {
  let offset = 0;
  while (offset + 4 <= extra.byteLength) {
    const id = extra.getUint16(offset, true);
    const size = extra.getUint16(offset + 2, true);
    if (offset + 4 + size > extra.byteLength) return undefined;
    if (id === zip64ExtraId)
      return new DataView(extra.buffer, extra.byteOffset + offset + 4, size);
    offset += 4 + size;
  }
  return undefined;
}

/** Replaces saturated 32-bit fields with the zip64 extra's 64-bit values, which appear in this fixed order. */
function resolveZip64(
  classic: Zip64Fields,
  extra: DataView,
): Zip64Fields | "malformed" {
  const uncompressedSaturated = classic.uncompressedSize === saturated;
  const compressedSaturated = classic.compressedSize === saturated;
  const offsetSaturated = classic.localHeaderOffset === saturated;
  const neededCount = [
    uncompressedSaturated,
    compressedSaturated,
    offsetSaturated,
  ].filter(Boolean).length;
  if (neededCount === 0) return classic;
  const zip64 = findZip64Extra(extra);
  if (!zip64 || zip64.byteLength < neededCount * 8) return "malformed";
  const compressedIndex = uncompressedSaturated ? 1 : 0;
  const offsetIndex = compressedIndex + (compressedSaturated ? 1 : 0);
  const uncompressedSize = uncompressedSaturated
    ? readSafeUint64(zip64, 0)
    : classic.uncompressedSize;
  const compressedSize = compressedSaturated
    ? readSafeUint64(zip64, compressedIndex * 8)
    : classic.compressedSize;
  const localHeaderOffset = offsetSaturated
    ? readSafeUint64(zip64, offsetIndex * 8)
    : classic.localHeaderOffset;
  if (
    uncompressedSize === undefined ||
    compressedSize === undefined ||
    localHeaderOffset === undefined
  )
    return "malformed";
  return { compressedSize, localHeaderOffset, uncompressedSize };
}

/** True when only the digital signature record that may close a central directory, or nothing, follows `offset`. */
function isDirectoryEnd(view: DataView, offset: number): boolean {
  return (
    offset === view.byteLength ||
    (offset + digitalSignatureFixedSize <= view.byteLength &&
      view.getUint32(offset, true) === digitalSignatureSignature &&
      offset + digitalSignatureFixedSize + view.getUint16(offset + 4, true) ===
        view.byteLength)
  );
}

/**
 * Parses every central directory record, or "malformed" when the declared count of records doesn't fill the directory
 * or an entry's local header and data would run into the directory at `directoryOffset`.
 */
export function parseCentralDirectory({
  bytes,
  directoryOffset,
  entryCount,
}: {
  bytes: Uint8Array;
  directoryOffset: number;
  entryCount: number;
}): ZipEntry[] | "malformed" {
  const view = viewOf(bytes);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (entries.length < entryCount) {
    if (offset + recordFixedSize > bytes.length) return "malformed";
    if (view.getUint32(offset, true) !== recordSignature) return "malformed";
    const nameStart = offset + recordFixedSize;
    const extraStart = nameStart + view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const next = extraStart + extraLength + view.getUint16(offset + 32, true);
    if (next > bytes.length) return "malformed";
    const sizes = resolveZip64(
      {
        compressedSize: view.getUint32(offset + 20, true),
        localHeaderOffset: view.getUint32(offset + 42, true),
        uncompressedSize: view.getUint32(offset + 24, true),
      },
      new DataView(bytes.buffer, bytes.byteOffset + extraStart, extraLength),
    );
    if (sizes === "malformed") return "malformed";
    const dataEnd =
      sizes.localHeaderOffset + localHeaderFixedSize + sizes.compressedSize;
    if (dataEnd > directoryOffset) return "malformed";
    entries.push({
      ...sizes,
      compressionMethod: view.getUint16(offset + 10, true),
      crc32: view.getUint32(offset + 16, true),
      encrypted: (view.getUint16(offset + 8, true) & 1) === 1,
      name: decoder.decode(bytes.subarray(nameStart, extraStart)),
    });
    offset = next;
  }
  return isDirectoryEnd(view, offset) ? entries : "malformed";
}
