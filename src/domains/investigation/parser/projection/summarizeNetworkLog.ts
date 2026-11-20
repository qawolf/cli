import type {
  NetworkLog,
  NetworkLogEntry,
} from "~/domains/investigation/parser/networkLog/networkLog.js";

import { redactAndBoundAttemptEvidenceResult } from "./attemptEvidenceText.js";

const summaryLimit = 10;
const maxMetadataBytes = 2 * 1024;

function boundNetworkLogText(text: string | undefined, maxBytes: number) {
  return text === undefined
    ? undefined
    : redactAndBoundAttemptEvidenceResult(text, maxBytes);
}

function networkLogCoverage(log: NetworkLog, returned: number, total: number) {
  return {
    incomplete: !log.closed || log.droppedRows > 0,
    malformed: log.malformed,
    returned,
    total,
    truncated: returned < total,
  };
}

// Stable sort: rows that started at the same time keep the device's order.
function byNetworkLogStart(entries: NetworkLogEntry[]): NetworkLogEntry[] {
  const start = (entry: NetworkLogEntry) =>
    entry.startedAtMilliseconds ?? Number.MAX_SAFE_INTEGER;
  return entries.toSorted((left, right) => start(left) - start(right));
}

function shapeNetworkLogEntry(entry: NetworkLogEntry) {
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

// The last failed requests before the attempt ended, as for a trace.
export function summarizeNetworkLogErrors(log: NetworkLog) {
  const failed = byNetworkLogStart(
    log.entries.filter((entry) => entry.failureReason),
  );
  const items = failed.slice(-summaryLimit).map(shapeNetworkLogEntry);
  return {
    coverage: networkLogCoverage(log, items.length, failed.length),
    items,
  };
}
