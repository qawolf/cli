// oxlint-disable eslint/max-lines -- Keep tail parsing, absolute offsets, and retention policy in one module.

import {
  type RunLogLimits,
  type RunLogRecord,
  type RunLogs,
  type RunLogSeverity,
  type RunLogsReadResult,
  runLogLimits,
} from "./runLogsTypes.js";

export type {
  RunLogLimits,
  RunLogs,
  RunLogsReadResult,
} from "./runLogsTypes.js";

type RawRunLogRecord = {
  message: string;
  severity: RunLogSeverity;
  source: string;
  timestamp: string;
};

const severities = new Set<RunLogSeverity>([
  "error",
  "info",
  "verbose",
  "warning",
]);

function parseRunLogRecord(raw: string): RawRunLogRecord | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return undefined;
  const record = value as Partial<RawRunLogRecord>;
  if (
    typeof record.message !== "string" ||
    typeof record.severity !== "string" ||
    !severities.has(record.severity) ||
    typeof record.source !== "string" ||
    record.source.length === 0 ||
    typeof record.timestamp !== "string"
  )
    return undefined;
  return {
    message: record.message,
    severity: record.severity,
    source: record.source,
    timestamp: record.timestamp,
  };
}

function truncateUtf8(
  value: string,
  maxBytes: number,
): { truncated: boolean; value: string } {
  const bytes = Buffer.from(value);
  const boundedByteLength = Math.max(0, maxBytes);
  if (bytes.byteLength <= boundedByteLength) return { truncated: false, value };
  let end = boundedByteLength;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  while (end > 0) {
    try {
      return { truncated: true, value: decoder.decode(bytes.subarray(0, end)) };
    } catch {
      end -= 1;
    }
  }
  return { truncated: true, value: "" };
}

export function parseRunLogs(
  raw: Buffer,
  options: { limits?: Partial<RunLogLimits> } = {},
): Extract<RunLogsReadResult, { logs: RunLogs }> {
  const limits = { ...runLogLimits, ...options.limits };
  const maxArtifactBytes = Math.max(0, limits.maxArtifactBytes);
  const artifactIncomplete = raw.byteLength > maxArtifactBytes;
  const unalignedStart = artifactIncomplete
    ? raw.byteLength - maxArtifactBytes
    : 0;
  const unalignedStartIsLineBoundary = raw[unalignedStart - 1] === 0x0a;
  const firstNewline = raw.indexOf(0x0a, unalignedStart);
  const windowStart = !artifactIncomplete
    ? 0
    : unalignedStartIsLineBoundary
      ? unalignedStart
      : firstNewline === -1
        ? raw.byteLength
        : firstNewline + 1;
  const boundedRaw = raw.subarray(windowStart);
  const boundedText = boundedRaw.toString("utf8");
  const endsWithCompleteLine = boundedRaw.at(-1) === 0x0a;
  const lines = boundedText.split("\n");
  const parseLineCount = lines.length;
  const records: RunLogRecord[] = [];
  let malformed = 0;
  let total = 0;
  let messageTruncated = false;
  let trailingMalformed = false;
  let byteOffset = windowStart;

  const maxRecords = Math.max(0, limits.maxRecords);
  for (
    let windowLineIndex = 0;
    windowLineIndex < parseLineCount;
    windowLineIndex += 1
  ) {
    const encodedLine = lines[windowLineIndex] ?? "";
    const recordByteOffset = byteOffset;
    byteOffset += Buffer.byteLength(encodedLine) + 1;
    const rawLine = encodedLine.replace(/\r$/, "");
    if (rawLine.length === 0) {
      if (windowLineIndex !== lines.length - 1) malformed += 1;
      continue;
    }
    const parsed = parseRunLogRecord(rawLine);
    if (!parsed) {
      malformed += 1;
      trailingMalformed =
        !endsWithCompleteLine && windowLineIndex === parseLineCount - 1;
      continue;
    }
    total += 1;
    const boundedMessage = truncateUtf8(parsed.message, limits.maxMessageBytes);
    const record: RunLogRecord = {
      ...parsed,
      byteOffset: recordByteOffset,
      id: `log:${recordByteOffset}`,
      message: boundedMessage.value,
      messageTruncated: boundedMessage.truncated,
    };
    if (maxRecords === 0) continue;
    if (records.length < maxRecords) {
      records.push(record);
      messageTruncated ||= boundedMessage.truncated;
      continue;
    }
    const replacementIndex = records.findIndex(
      ({ severity }) => severity === "info" || severity === "verbose",
    );
    const recordIsSubstantive =
      record.severity === "error" || record.severity === "warning";
    if (recordIsSubstantive || replacementIndex !== -1) {
      records.splice(replacementIndex === -1 ? 0 : replacementIndex, 1);
      records.push(record);
      messageTruncated ||= boundedMessage.truncated;
    }
  }

  const incomplete = artifactIncomplete || trailingMalformed;
  const truncated =
    artifactIncomplete || messageTruncated || records.length < total;
  const logs: RunLogs = {
    coverage: {
      incomplete,
      malformed,
      returned: records.length,
      total,
      truncated,
    },
    records,
  };
  if (incomplete) return { logs, status: "incomplete" };
  if (malformed > 0 && total === 0) return { logs, status: "malformed" };
  return { logs, status: "ready" };
}
