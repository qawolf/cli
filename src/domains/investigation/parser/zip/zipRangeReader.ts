import type {
  ArtifactFailure,
  RangeReader,
} from "~/domains/investigation/types.js";

export function isReadFailure<Read extends object>(
  read: Read | ArtifactFailure,
): read is ArtifactFailure {
  return "status" in read;
}

export function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/** A little-endian 64-bit size, or undefined when it can't be a JS number. */
export function readSafeUint64(
  view: DataView,
  offset: number,
): number | undefined {
  const value = view.getBigUint64(offset, true);
  return value > BigInt(Number.MAX_SAFE_INTEGER) ? undefined : Number(value);
}

type BudgetedReader = {
  bytesRead: () => number;
  readRange: RangeReader;
};

/** Fails a read with "too-large", before fetching it, once it would take the total past `maxBytes`. */
export function budgetedReader(
  readRange: RangeReader,
  maxBytes: number,
): BudgetedReader {
  let total = 0;
  return {
    bytesRead: () => total,
    async readRange(start, length) {
      if (total + length > maxBytes) return { status: "too-large" };
      total += length;
      return readRange(start, length);
    },
  };
}
