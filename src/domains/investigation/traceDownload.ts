import { downloadTimeoutMs, fetchAndRead } from "./artifactRequest.js";
import {
  type ArtifactDownload,
  downloadWhole,
  readBounded,
  responseFailure,
} from "./download.js";
import type { ArtifactFailure, RangeReader } from "./types.js";

type TraceDownload =
  | ArtifactDownload
  | { readRange: RangeReader; sizeBytes: number; status: "ranged" };

const traceLimit = 75 * 1024 * 1024;

function rangeHeaders(start: number, length: number) {
  return { range: `bytes=${start}-${start + length - 1}` };
}

async function partialContent(
  response: Response,
  start: number,
  length: number,
): Promise<Uint8Array | ArtifactFailure> {
  if (!response.ok) return responseFailure(response);
  if (response.status !== 206) {
    await response.body?.cancel().catch(() => undefined);
    return { status: "too-large" };
  }
  const read = await readBounded(response, {
    keepTail: false,
    retainBytes: length,
    transferBytes: length,
  });
  if (read.status === "too-large") return { status: "unavailable" };
  if (read.status !== "available") return read;
  return read.offset === start && read.bytes.byteLength === length
    ? read.bytes
    : { status: "unavailable" };
}

function totalSize(response: Response): number | undefined {
  const total = /\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
  return total ? Number(total[1]) : undefined;
}

/** Every read shares one deadline, which starts at the first read so earlier downloads don't spend it. */
function rangeReader(
  url: string,
  fetchImpl: typeof globalThis.fetch,
): RangeReader {
  let deadline: AbortSignal | undefined;
  return (start, length) => {
    if (length < 1) return Promise.resolve(new Uint8Array());
    deadline ??= AbortSignal.timeout(downloadTimeoutMs);
    const headers = rangeHeaders(start, length);
    return fetchAndRead({ deadline, fetchImpl, headers, url }, (response) =>
      partialContent(response, start, length),
    );
  };
}

async function openRangedTrace(
  url: string,
  fetchImpl: typeof globalThis.fetch,
): Promise<TraceDownload> {
  const headers = rangeHeaders(0, 1);
  const probe = await fetchAndRead(
    { fetchImpl, headers, url },
    async (response) => ({
      firstByte: await partialContent(response, 0, 1),
      sizeBytes: totalSize(response),
    }),
  );
  if ("status" in probe) return probe;
  if (!(probe.firstByte instanceof Uint8Array)) return probe.firstByte;
  if (probe.sizeBytes === undefined) return { status: "too-large" };
  const readRange = rangeReader(url, fetchImpl);
  return { readRange, sizeBytes: probe.sizeBytes, status: "ranged" };
}

export async function downloadTrace(
  url: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<TraceDownload> {
  const whole = await downloadWhole(url, traceLimit, fetchImpl);
  if (whole.status !== "too-large") return whole;
  return openRangedTrace(url, fetchImpl);
}
