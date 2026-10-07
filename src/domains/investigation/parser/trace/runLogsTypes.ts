import type { Coverage } from "./playwrightTraceTypes.js";

export type RunLogSeverity = "error" | "info" | "verbose" | "warning";

export type RunLogRecord = {
  byteOffset: number;
  id: string;
  message: string;
  messageTruncated: boolean;
  severity: RunLogSeverity;
  source: string;
  timestamp: string;
};

export type RunLogLimits = {
  /** Bounds the tail window parsed after `readFileIfExists` returns a Buffer. */
  maxArtifactBytes: number;
  maxMessageBytes: number;
  maxRecords: number;
};

export const runLogLimits: RunLogLimits = {
  maxArtifactBytes: 5 * 1024 * 1024,
  maxMessageBytes: 16 * 1024,
  maxRecords: 5_000,
};

export type RunLogs = {
  coverage: Coverage;
  records: RunLogRecord[];
};

export type RunLogsReadResult =
  | { status: "missing" }
  | { status: "storage-unavailable" }
  | { logs: RunLogs; status: "incomplete" | "malformed" | "ready" };
