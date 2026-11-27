import { crc32, deflateRawSync } from "node:zlib";

import type { RangeReader } from "~/domains/investigation/types.js";

export type FixtureEntry = {
  compress?: boolean;
  content: Uint8Array | string;
  name: string;
};

const saturated32 = 0xffffffff;

function record(fields: [number, 2 | 4 | 8][]): Buffer {
  const size = fields.reduce((total, [, width]) => total + width, 0);
  const bytes = Buffer.alloc(size);
  fields.reduce((offset, [value, width]) => {
    if (width === 2) bytes.writeUInt16LE(value, offset);
    else if (width === 4) bytes.writeUInt32LE(value, offset);
    else bytes.writeBigUInt64LE(BigInt(value), offset);
    return offset + width;
  }, 0);
  return bytes;
}

/** A zip written by hand, so tests control zip64 records and every field a reader checks. */
export function buildZip(
  entries: FixtureEntry[],
  options: { comment?: string; zip64?: boolean } = {},
): Buffer {
  const zip64 = options.zip64 === true;
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const raw = Buffer.from(entry.content);
    const data = entry.compress ? deflateRawSync(raw) : raw;
    const name = Buffer.from(entry.name);
    const method = entry.compress ? 8 : 0;
    const checksum = crc32(raw);
    const local = record([
      [0x04034b50, 4],
      [20, 2],
      [0, 2],
      [method, 2],
      [0, 2],
      [0, 2],
      [checksum, 4],
      [data.length, 4],
      [raw.length, 4],
      [name.length, 2],
      [0, 2],
    ]);
    const extra = zip64
      ? record([
          [1, 2],
          [24, 2],
          [raw.length, 8],
          [data.length, 8],
          [offset, 8],
        ])
      : Buffer.alloc(0);
    central.push(
      record([
        [0x02014b50, 4],
        [45, 2],
        [20, 2],
        [0, 2],
        [method, 2],
        [0, 2],
        [0, 2],
        [checksum, 4],
        [zip64 ? saturated32 : data.length, 4],
        [zip64 ? saturated32 : raw.length, 4],
        [name.length, 2],
        [extra.length, 2],
        [0, 2],
        [0, 2],
        [0, 2],
        [0, 4],
        [zip64 ? saturated32 : offset, 4],
      ]),
      name,
      extra,
    );
    parts.push(local, name, data);
    offset += local.length + name.length + data.length;
  }
  const directory = Buffer.concat(central);
  const comment = Buffer.from(options.comment ?? "", "latin1");
  const zip64Records = zip64
    ? [
        record([
          [0x06064b50, 4],
          [44, 8],
          [45, 2],
          [45, 2],
          [0, 4],
          [0, 4],
          [entries.length, 8],
          [entries.length, 8],
          [directory.length, 8],
          [offset, 8],
        ]),
        record([
          [0x07064b50, 4],
          [0, 4],
          [offset + directory.length, 8],
          [1, 4],
        ]),
      ]
    : [];
  const end = record([
    [0x06054b50, 4],
    [0, 2],
    [0, 2],
    [zip64 ? 0xffff : entries.length, 2],
    [zip64 ? 0xffff : entries.length, 2],
    [zip64 ? saturated32 : directory.length, 4],
    [zip64 ? saturated32 : offset, 4],
    [comment.length, 2],
  ]);
  return Buffer.concat([...parts, directory, ...zip64Records, end, comment]);
}

/** A copy of the zip with a 32-bit field of the named entry's central directory record overwritten. */
export function withCentralField(
  zip: Buffer,
  { field, name, value }: { field: number; name: string; value: number },
): Buffer {
  const patched = Buffer.from(zip);
  const at = patched.lastIndexOf(Buffer.from(name)) - 46;
  if (at < 0 || patched.readUInt32LE(at) !== 0x02014b50)
    throw new Error(`No central record for ${name}`);
  patched.writeUInt32LE(value, at + field);
  return patched;
}

export const centralField = {
  compressedSize: 20,
  crc32: 16,
  uncompressedSize: 24,
} as const;

/** Serves ranges of the zip from memory like storage does, counting what it served. */
export function memoryRangeReader(zip: Uint8Array): {
  bytesRead: () => number;
  reads: () => { length: number; start: number }[];
  readRange: RangeReader;
} {
  const reads: { length: number; start: number }[] = [];
  return {
    bytesRead: () => reads.reduce((total, read) => total + read.length, 0),
    reads: () => [...reads],
    async readRange(start, length) {
      if (start < 0 || start + length > zip.length)
        return { status: "unavailable" };
      reads.push({ length, start });
      return zip.slice(start, start + length);
    },
  };
}
