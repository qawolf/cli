import {
  type PlaywrightTrace,
  listTraceNetwork,
} from "../trace/playwrightTrace.js";

import { redactAndBoundAttemptEvidenceResult } from "./attemptEvidenceText.js";
import type { InspectionCommon } from "./inspectAttemptShared.js";

const maxNetworkMetadataBytes = 2 * 1024;

function shapeRequest(
  request: Awaited<ReturnType<typeof listTraceNetwork>>["items"][number],
) {
  const url = redactAndBoundAttemptEvidenceResult(
    request.url,
    maxNetworkMetadataBytes,
  );
  const failureText =
    request.failureText === undefined
      ? undefined
      : redactAndBoundAttemptEvidenceResult(
          request.failureText,
          maxNetworkMetadataBytes,
        );
  return {
    durationMilliseconds: request.durationMilliseconds,
    ...(failureText && { failureText: failureText.text }),
    ...((url.truncated || failureText?.truncated === true) && {
      metadataTruncated: true,
    }),
    method: request.method,
    requestId: request.id,
    startedAtMilliseconds: request.startedAtMilliseconds,
    status: request.status,
    streamId: request.streamId,
    url: url.text,
  };
}

export async function inspectNetwork(
  trace: PlaywrightTrace,
  common: InspectionCommon,
  target: {
    beforeRequestId?: string;
    endTimeMilliseconds?: number;
    limit: number;
    method?: string;
    startTimeMilliseconds?: number;
    status?: number;
    type: "network";
    urlContains?: string;
  },
) {
  const listed = await listTraceNetwork(trace, {
    limit: Number.MAX_SAFE_INTEGER,
  });
  const filtered = listed.items
    .filter(
      (request) =>
        (target.method === undefined ||
          request.method.toLowerCase() === target.method.toLowerCase()) &&
        (target.status === undefined || request.status === target.status) &&
        (target.urlContains === undefined ||
          request.url.includes(target.urlContains)) &&
        (target.startTimeMilliseconds === undefined ||
          (request.startedAtMilliseconds ?? -Infinity) >=
            target.startTimeMilliseconds) &&
        (target.endTimeMilliseconds === undefined ||
          (request.startedAtMilliseconds ?? Infinity) <=
            target.endTimeMilliseconds),
    )
    .toSorted(
      (left, right) =>
        (left.startedAtMilliseconds ?? Infinity) -
          (right.startedAtMilliseconds ?? Infinity) ||
        left.streamId.localeCompare(right.streamId) ||
        left.id.localeCompare(right.id),
    );
  const boundary = target.beforeRequestId
    ? filtered.findIndex((request) => request.id === target.beforeRequestId)
    : filtered.length;
  if (boundary === -1) {
    return {
      ...common,
      coverage: { ...listed.coverage, returned: 0, total: filtered.length },
      entries: [],
      status: "not-found" as const,
      type: target.type,
    };
  }
  const start = Math.max(0, boundary - target.limit);
  const selected = filtered.slice(start, boundary);
  return {
    ...common,
    coverage: {
      ...listed.coverage,
      returned: selected.length,
      total: filtered.length,
      truncated:
        listed.coverage.truncated || start > 0 || boundary < filtered.length,
    },
    entries: selected.map(shapeRequest),
    ...(start > 0 && selected[0] && { nextBeforeRequestId: selected[0].id }),
    status: "available" as const,
    type: target.type,
  };
}
