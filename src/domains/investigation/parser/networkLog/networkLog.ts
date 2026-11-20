// Reads the iOS device network log (`networkLogsUrl`, NDJSON). Request and
// connection lines are HAR 1.2 entries with `_qawolf` fields; DNS and WebSocket
// lines are skipped; the last line is a summary written when the file closed.

export type NetworkFailureReason =
  | "canceled"
  | "connection-failed"
  | "http-error"
  | "interrupted";

export type NetworkLogEntry = {
  app: string | undefined;
  /** A body was cut: the 64 KiB capture limit, or the exchange broke. */
  bodyTruncated: boolean;
  durationMilliseconds: number | undefined;
  failureReason: NetworkFailureReason | undefined;
  failureText: string | undefined;
  id: string;
  kind: string;
  method: string;
  requestBody: string | undefined;
  requestHeaders: Record<string, string>;
  responseBody: string | undefined;
  responseHeaders: Record<string, string>;
  startedAtMilliseconds: number | undefined;
  status: number;
  url: string;
};

export type NetworkLog = {
  closed: boolean;
  droppedRows: number;
  entries: NetworkLogEntry[];
  malformed: number;
};

type Row = Record<string, unknown>;

const requestKinds = new Set([
  "connection",
  "connection-failed",
  "encrypted",
  "http",
]);
const sensitiveHeader =
  /^(authorization|cookie|set-cookie|proxy-authorization|x-api-key)$/i;

const asRow = (value: unknown): Row | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Row)
    : undefined;
const asString = (value: unknown) =>
  typeof value === "string" ? value : undefined;
const asNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

function parseLine(line: string): Row | undefined {
  try {
    return asRow(JSON.parse(line));
  } catch {
    return undefined;
  }
}

function toHeaders(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) return {};
  return Object.fromEntries(
    value.flatMap((header) => {
      const name = asString(asRow(header)?.["name"]);
      const headerValue = asString(asRow(header)?.["value"]);
      if (name === undefined || headerValue === undefined) return [];
      return [[name, sensitiveHeader.test(name) ? "[REDACTED]" : headerValue]];
    }),
  );
}

// A tunnel QA Wolf did not read ends with EOF when either side closes it: not a
// failure. Another error on a `connection` line (no TLS seen) is a failed dial.
export function networkFailureReason(
  kind: string,
  status: number,
  failureText: string | undefined,
): NetworkFailureReason | undefined {
  if (kind === "connection-failed") return "connection-failed";
  if (status >= 400) return "http-error";
  if (failureText === undefined) return undefined;
  if (failureText === "context canceled") return "canceled";
  if (kind !== "http" && failureText === "EOF") return undefined;
  return kind === "connection" ? "connection-failed" : "interrupted";
}

function toEntry(
  row: Row,
  extras: Row,
  kind: string,
): NetworkLogEntry | undefined {
  const request = asRow(row["request"]);
  const response = asRow(row["response"]);
  const id = asString(extras["cursor"]);
  if (!request || !response || id === undefined) return undefined;
  const status = asNumber(response["status"]) ?? 0;
  const failureText = asString(extras["err"]);
  const started = Date.parse(asString(row["startedDateTime"]) ?? "");
  return {
    app: asString(extras["app"]),
    bodyTruncated: extras["bodyTruncated"] === true,
    durationMilliseconds: asNumber(row["time"]),
    failureReason: networkFailureReason(kind, status, failureText),
    failureText,
    id,
    kind,
    method: asString(request["method"]) ?? "",
    requestBody: asString(asRow(request["postData"])?.["text"]),
    requestHeaders: toHeaders(request["headers"]),
    responseBody: asString(asRow(response["content"])?.["text"]),
    responseHeaders: toHeaders(response["headers"]),
    startedAtMilliseconds: Number.isNaN(started) ? undefined : started,
    status,
    url: asString(request["url"]) ?? "",
  };
}

export function parseNetworkLog(bytes: Uint8Array): NetworkLog {
  const log: NetworkLog = {
    closed: false,
    droppedRows: 0,
    entries: [],
    malformed: 0,
  };
  for (const line of Buffer.from(bytes).toString("utf8").split("\n")) {
    if (!line.trim()) continue;
    const row = parseLine(line);
    const extras = asRow(row?.["_qawolf"]);
    const kind = asString(extras?.["kind"]);
    if (!row || !extras || kind === undefined) {
      log.malformed += 1;
      continue;
    }
    if (kind === "summary") {
      log.closed = true;
      log.droppedRows = asNumber(extras["droppedRows"]) ?? 0;
      continue;
    }
    if (!requestKinds.has(kind)) continue;
    const entry = toEntry(row, extras, kind);
    if (entry) log.entries.push(entry);
    else log.malformed += 1;
  }
  return log;
}
