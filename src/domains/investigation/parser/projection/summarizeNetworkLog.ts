import type {
  NetworkLog,
  NetworkLogEntry,
} from "~/domains/investigation/parser/networkLog/networkLog.js";

import { redactAndBoundAttemptEvidenceResult } from "./attemptEvidenceText.js";

const summaryLimit = 10;
const maxMetadataBytes = 2 * 1024;

export function boundNetworkLogText(
  text: string | undefined,
  maxBytes: number,
) {
  return text === undefined
    ? undefined
    : redactAndBoundAttemptEvidenceResult(text, maxBytes);
}

export function networkLogCoverage(
  log: NetworkLog,
  returned: number,
  total: number,
) {
  return {
    incomplete: !log.closed || log.droppedRows > 0,
    malformed: log.malformed,
    returned,
    total,
    truncated: returned < total,
  };
}

// Stable sort: rows that started at the same time keep the device's order. A
// row with no start time sorts first, as in the trace summary.
export function byNetworkLogStart(
  entries: NetworkLogEntry[],
): NetworkLogEntry[] {
  const start = (entry: NetworkLogEntry) =>
    entry.startedAtMilliseconds ?? Number.NEGATIVE_INFINITY;
  return entries.toSorted((left, right) => start(left) - start(right) || 0);
}

export function shapeNetworkLogEntry(entry: NetworkLogEntry) {
  const url = redactAndBoundAttemptEvidenceResult(entry.url, maxMetadataBytes);
  const failureText = boundNetworkLogText(entry.failureText, maxMetadataBytes);
  return {
    ...(entry.app !== undefined && { app: entry.app }),
    durationMilliseconds: entry.durationMilliseconds,
    ...(entry.failureReason && { failureReason: entry.failureReason }),
    ...(failureText && { failureText: failureText.text }),
    kind: entry.kind,
    ...((url.truncated || failureText?.truncated === true) && {
      metadataTruncated: true,
    }),
    method: entry.method,
    requestId: entry.id,
    startedAtMilliseconds: entry.startedAtMilliseconds,
    status: entry.status,
    url: url.text,
  };
}

// The last failed requests before the attempt ended, as for a trace. App
// cancels only fill the places that other failures leave.
export function summarizeNetworkLogErrors(log: NetworkLog) {
  const failed = byNetworkLogStart(
    log.entries.filter((entry) => entry.failureReason),
  );
  const isCanceled = (entry: NetworkLogEntry) =>
    entry.failureReason === "canceled";
  const others = failed.filter((entry) => !isCanceled(entry));
  const places = Math.max(0, summaryLimit - others.length);
  const kept = new Set([
    ...others.slice(-summaryLimit),
    ...(places === 0 ? [] : failed.filter(isCanceled).slice(-places)),
  ]);
  const items = failed.filter((entry) => kept.has(entry));
  return {
    coverage: networkLogCoverage(log, items.length, failed.length),
    items: items.map(shapeNetworkLogEntry),
  };
}
