import type { ArtifactFailure } from "~/domains/investigation/types.js";

import { isReadFailure } from "./zipRangeReader.js";

type Chunk = Uint8Array | ArtifactFailure | "corrupt";

function arrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return bytes.buffer instanceof ArrayBuffer
    ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    : new Uint8Array(bytes);
}

async function feed(
  chunks: AsyncIterable<Uint8Array | ArtifactFailure>,
  writer: ReturnType<DecompressionStream["writable"]["getWriter"]>,
): Promise<ArtifactFailure | undefined> {
  for await (const chunk of chunks) {
    if (isReadFailure(chunk)) {
      await writer.abort().catch(() => undefined);
      return chunk;
    }
    const written = await writer.write(arrayBufferView(chunk)).then(
      () => true,
      () => false,
    );
    if (!written) return undefined;
  }
  await writer.close().catch(() => undefined);
  return undefined;
}

/** Inflates raw deflate chunks; bytes that don't decode end the stream with "corrupt", and a failed read with that failure. */
export async function* inflateRaw(
  chunks: AsyncIterable<Uint8Array | ArtifactFailure>,
): AsyncGenerator<Chunk> {
  const inflater = new DecompressionStream("deflate-raw");
  const reader = inflater.readable.getReader();
  const feeding = feed(chunks, inflater.writable.getWriter());
  feeding.catch(() => undefined);
  try {
    while (true) {
      const result = await reader.read().then(
        (value) => value,
        () => "corrupt" as const,
      );
      if (result === "corrupt") {
        yield (await feeding.catch(() => undefined)) ?? "corrupt";
        return;
      }
      if (result.done) return;
      yield result.value;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

/**
 * Gathers chunks up to `wanted` bytes. With `exact`, more bytes than `wanted` are "corrupt",
 * so a lying size can't inflate without bound; without it, reading stops once `wanted` is reached.
 */
export async function collect(
  chunks: AsyncIterable<Chunk>,
  wanted: number,
  exact: boolean,
): Promise<Buffer | ArtifactFailure | "corrupt"> {
  const parts: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of chunks) {
    if (chunk === "corrupt" || isReadFailure(chunk)) return chunk;
    parts.push(chunk);
    total += chunk.byteLength;
    if (exact && total > wanted) return "corrupt";
    if (!exact && total >= wanted) break;
  }
  return Buffer.concat(parts);
}
