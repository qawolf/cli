import type { NetworkLog } from "~/domains/investigation/parser/networkLog/networkLog.js";

import { redactInspectionHeaders } from "./inspectAttemptRequestHeaders.js";
import {
  boundNetworkLogText,
  byNetworkLogStart,
  networkLogCoverage,
  shapeNetworkLogEntry,
} from "./summarizeNetworkLog.js";

const maxBodyBytes = 64 * 1024;

export type NetworkLogFilter = {
  endTimeMilliseconds?: number;
  failed?: boolean;
  limit: number;
  method?: string;
  startTimeMilliseconds?: number;
  status?: number;
  type: "network";
  urlContains?: string;
};

function shapeBody(text: string | undefined, cut: boolean) {
  const body = boundNetworkLogText(text, maxBodyBytes);
  return body
    ? {
        status: "available" as const,
        text: body.text,
        truncated: cut || body.truncated,
      }
    : { status: "unavailable" as const };
}

export function inspectNetworkLog<Common extends object>(
  log: NetworkLog,
  common: Common,
  target: NetworkLogFilter,
) {
  const filtered = byNetworkLogStart(
    log.entries.filter(
      (entry) =>
        (target.failed !== true || entry.failureReason !== undefined) &&
        (target.method === undefined ||
          entry.method.toLowerCase() === target.method.toLowerCase()) &&
        (target.status === undefined || entry.status === target.status) &&
        (target.urlContains === undefined ||
          entry.url.includes(target.urlContains)) &&
        (target.startTimeMilliseconds === undefined ||
          (entry.startedAtMilliseconds ?? -Infinity) >=
            target.startTimeMilliseconds) &&
        (target.endTimeMilliseconds === undefined ||
          (entry.startedAtMilliseconds ?? Infinity) <=
            target.endTimeMilliseconds),
    ),
  );
  const selected = filtered.slice(-target.limit);
  return {
    ...common,
    coverage: networkLogCoverage(log, selected.length, filtered.length),
    entries: selected.map(shapeNetworkLogEntry),
    status: "available" as const,
    type: target.type,
  };
}

export function inspectNetworkLogRequest<Common extends object>(
  log: NetworkLog,
  common: Common,
  target: { requestId: string; type: "request" },
) {
  const entry = log.entries.find((item) => item.id === target.requestId);
  if (!entry)
    return { ...common, status: "not-found" as const, type: target.type };
  const requestHeaders = redactInspectionHeaders(entry.requestHeaders);
  const responseHeaders = redactInspectionHeaders(entry.responseHeaders);
  const { metadataTruncated, ...shaped } = shapeNetworkLogEntry(entry);
  return {
    ...common,
    body: shapeBody(entry.responseBody, entry.bodyTruncated),
    request: {
      ...shaped,
      ...((metadataTruncated === true ||
        requestHeaders.truncated ||
        responseHeaders.truncated) && { metadataTruncated: true }),
      requestHeaders: requestHeaders.headers,
      responseHeaders: responseHeaders.headers,
    },
    requestBody: shapeBody(entry.requestBody, entry.bodyTruncated),
    status: "available" as const,
    type: target.type,
  };
}
