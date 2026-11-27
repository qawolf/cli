import {
  type ArtifactDownload,
  downloadFailure,
  downloadTimeoutMs,
  downloadWhole,
  readBounded,
  responseFailure,
} from "./download.js";
import type { ArtifactFailure, RangeReader } from "./types.js";

type TraceDownload =
  | ArtifactDownload
  | { readRange: RangeReader; sizeBytes: number; status: "ranged" };

const traceLimit = 75 * 1024 * 1024;

function requestRange(
  target: {
    fetchImpl: typeof globalThis.fetch;
    signal: AbortSignal;
    url: string;
  },
  start: number,
  length: number,
): Promise<Response> {
  return target.fetchImpl(target.url, {
    headers: { range: `bytes=${start}-${start + length - 1}` },
    redirect: "follow",
    signal: target.signal,
  });
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
  if (read.status !== "available") return read;
  return read.offset === start && read.bytes.byteLength === length
    ? read.bytes
    : { status: "unavailable" };
}

function totalSize(response: Response): number | undefined {
  const total = /\/(\d+)$/.exec(response.headers.get("content-range") ?? "");
  return total ? Number(total[1]) : undefined;
}

async function openRangedTrace(
  url: string,
  fetchImpl: typeof globalThis.fetch,
): Promise<TraceDownload> {
  const target = {
    fetchImpl,
    signal: AbortSignal.timeout(downloadTimeoutMs),
    url,
  };
  const readRange: RangeReader = async (start, length) => {
    if (length < 1) return new Uint8Array();
    try {
      const response = await requestRange(target, start, length);
      return await partialContent(response, start, length);
    } catch (error) {
      return downloadFailure(error);
    }
  };
  try {
    const probe = await requestRange(target, 0, 1);
    const sizeBytes = totalSize(probe);
    const firstByte = await partialContent(probe, 0, 1);
    if (!(firstByte instanceof Uint8Array)) return firstByte;
    if (sizeBytes === undefined) return { status: "too-large" };
    return { readRange, sizeBytes, status: "ranged" };
  } catch (error) {
    return downloadFailure(error);
  }
}

export async function downloadTrace(
  url: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<TraceDownload> {
  const whole = await downloadWhole(url, traceLimit, fetchImpl);
  if (whole.status !== "too-large") return whole;
  return openRangedTrace(url, fetchImpl);
}
