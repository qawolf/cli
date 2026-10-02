export type ArtifactDownload =
  | { bytes: Uint8Array; offset: number; status: "available" }
  | { status: "expired-url" | "not-found" | "too-large" | "unavailable" };

const traceLimit = 50 * 1024 * 1024;
const logTailLimit = 5 * 1024 * 1024;
const logTransferLimit = 50 * 1024 * 1024;

async function responseFailure(response: Response): Promise<ArtifactDownload> {
  await response.body?.cancel().catch(() => undefined);
  if (response.status === 404) return { status: "not-found" };
  if (response.status === 401 || response.status === 403)
    return { status: "expired-url" };
  return { status: "unavailable" };
}

async function readBounded(
  response: Response,
  options: { keepTail: boolean; retainBytes: number; transferBytes: number },
): Promise<ArtifactDownload> {
  if (!response.ok) return responseFailure(response);
  const declaredLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > options.transferBytes
  ) {
    await response.body?.cancel().catch(() => undefined);
    return { status: "too-large" };
  }
  if (!response.body) return { status: "unavailable" };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let retained = 0;
  let transferred = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    const chunk: unknown = next.value;
    if (!(chunk instanceof Uint8Array)) {
      await reader.cancel();
      return { status: "unavailable" };
    }
    transferred += chunk.byteLength;
    if (transferred > options.transferBytes) {
      await reader.cancel();
      return { status: "too-large" };
    }
    chunks.push(chunk);
    retained += chunk.byteLength;
    if (options.keepTail) {
      while (
        chunks.length > 1 &&
        retained - chunks[0]!.byteLength >= options.retainBytes
      ) {
        retained -= chunks.shift()!.byteLength;
      }
    } else if (retained > options.retainBytes) {
      await reader.cancel();
      return { status: "too-large" };
    }
  }
  let bytes = Buffer.concat(chunks);
  const contentRange = response.headers.get("content-range");
  const rangeStart = contentRange
    ? Number(/^bytes (\d+)-/.exec(contentRange)?.[1])
    : Number.NaN;
  let offset = Number.isFinite(rangeStart)
    ? rangeStart
    : transferred - bytes.byteLength;
  if (bytes.byteLength > options.retainBytes) {
    const removed = bytes.byteLength - options.retainBytes;
    bytes = bytes.subarray(removed);
    offset += removed;
  }
  return { bytes, offset, status: "available" };
}

export async function downloadTrace(
  url: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<ArtifactDownload> {
  try {
    const signal = AbortSignal.timeout(30_000);
    const response = await fetchImpl(url, { redirect: "follow", signal });
    return await readBounded(response, {
      keepTail: false,
      retainBytes: traceLimit,
      transferBytes: traceLimit,
    });
  } catch {
    return { status: "unavailable" };
  }
}

export async function downloadLogTail(
  url: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<ArtifactDownload> {
  try {
    const signal = AbortSignal.timeout(30_000);
    const response = await fetchImpl(url, {
      headers: { range: `bytes=-${logTailLimit}` },
      redirect: "follow",
      signal,
    });
    return await readBounded(response, {
      keepTail: true,
      retainBytes: logTailLimit,
      transferBytes: logTransferLimit,
    });
  } catch {
    return { status: "unavailable" };
  }
}
