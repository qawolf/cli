// oxlint-disable eslint/max-lines -- Keep the typed recorded-evidence projections aligned with the platform implementation.

import {
  type PlaywrightTrace,
  listTraceConsole,
  listTraceNetwork,
  readTraceResponseBody,
  readTraceScreenshot,
} from "~/domains/investigation/parser/trace/playwrightTrace.js";

import { redactAndBoundAttemptEvidenceResult } from "./attemptEvidenceText.js";
import { redactInspectionHeaders } from "./inspectAttemptRequestHeaders.js";
import type { InspectionCommon } from "./inspectAttemptShared.js";

const maxConsoleEvidenceBytes = 1024;
const maxRequestMetadataBytes = 2 * 1024;
const maxResponseBodyBytes = 64 * 1024;

export async function inspectScreenshot(
  trace: PlaywrightTrace,
  common: InspectionCommon,
  target: { screenshotId: string; type: "screenshot" },
) {
  const result = await readTraceScreenshot(trace, target.screenshotId, {
    maxBytes: 1024 * 1024,
  });
  if (!result)
    return { ...common, status: "not-found" as const, type: target.type };
  const screenshot = {
    height: result.screenshot.height,
    pageId: result.screenshot.pageId,
    screenshotId: result.screenshot.id,
    timestampMilliseconds: result.screenshot.timestamp,
    width: result.screenshot.width,
  };
  return result.status === "available"
    ? {
        ...common,
        imageJpegBase64: result.imageJpegBase64,
        screenshot,
        status: result.status,
        type: target.type,
      }
    : { ...common, screenshot, status: result.status, type: target.type };
}

function isTextualContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const mime = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return (
    mime.startsWith("text/") ||
    mime.endsWith("+json") ||
    mime.endsWith("+xml") ||
    ["application/javascript", "application/json", "application/xml"].includes(
      mime,
    )
  );
}

export async function inspectRequest(
  trace: PlaywrightTrace,
  common: InspectionCommon,
  target: { requestId: string; type: "request" },
) {
  const entries = await listTraceNetwork(trace, {
    limit: Number.MAX_SAFE_INTEGER,
  });
  const request = entries.items.find((item) => item.id === target.requestId);
  if (!request)
    return { ...common, status: "not-found" as const, type: target.type };
  const contentType = Object.entries(request.responseHeaders).find(
    ([name]) => name.toLowerCase() === "content-type",
  )?.[1];
  const recordedBody = await readTraceResponseBody(trace, request.id, {
    maxBytes: maxResponseBodyBytes,
  });
  const body =
    recordedBody.status !== "available" || isTextualContentType(contentType)
      ? recordedBody
      : { status: "unsupported-binary" as const };
  const textualBody =
    body.status === "available"
      ? redactAndBoundAttemptEvidenceResult(
          Buffer.from(body.bodyBase64, "base64").toString("utf8"),
          maxResponseBodyBytes,
        )
      : undefined;
  const requestHeaders = redactInspectionHeaders(request.requestHeaders);
  const responseHeaders = redactInspectionHeaders(request.responseHeaders);
  const url = redactAndBoundAttemptEvidenceResult(
    request.url,
    maxRequestMetadataBytes,
  );
  const failureText =
    request.failureText === undefined
      ? undefined
      : redactAndBoundAttemptEvidenceResult(
          request.failureText,
          maxRequestMetadataBytes,
        );
  return {
    ...common,
    body:
      body.status === "available"
        ? {
            status: body.status,
            text: textualBody?.text,
            truncated: body.truncated || textualBody?.truncated === true,
          }
        : body,
    request: {
      durationMilliseconds: request.durationMilliseconds,
      ...(failureText && { failureText: failureText.text }),
      ...((failureText?.truncated === true ||
        requestHeaders.truncated ||
        responseHeaders.truncated ||
        url.truncated) && { metadataTruncated: true }),
      method: request.method,
      requestHeaders: requestHeaders.headers,
      requestId: request.id,
      responseHeaders: responseHeaders.headers,
      startedAtMilliseconds: request.startedAtMilliseconds,
      status: request.status,
      url: url.text,
    },
    status: "available" as const,
    type: target.type,
  };
}

export function inspectConsole(
  trace: PlaywrightTrace,
  common: InspectionCommon,
  target: {
    endTimeMilliseconds?: number;
    evidenceId?: string;
    limit: number;
    startTimeMilliseconds?: number;
    type: "console";
  },
) {
  const listed = listTraceConsole(trace, {
    limit: Number.MAX_SAFE_INTEGER,
    maxTextBytes: Number.MAX_SAFE_INTEGER,
  });
  const filtered = listed.items.filter(
    (entry) =>
      (target.evidenceId === undefined || entry.id === target.evidenceId) &&
      (target.startTimeMilliseconds === undefined ||
        (entry.time ?? -Infinity) >= target.startTimeMilliseconds) &&
      (target.endTimeMilliseconds === undefined ||
        (entry.time ?? Infinity) <= target.endTimeMilliseconds),
  );
  if (target.evidenceId && !filtered.length) {
    const preserveUpstreamTotal =
      listed.coverage.incomplete || listed.coverage.truncated;
    return {
      ...common,
      coverage: {
        ...listed.coverage,
        returned: 0,
        total: preserveUpstreamTotal ? listed.coverage.total : 0,
      },
      entries: [],
      status: "not-found" as const,
      type: target.type,
    };
  }
  const selected = filtered.slice(0, target.limit);
  const preserveUpstreamTotal =
    listed.coverage.incomplete || listed.coverage.truncated;
  const entries = selected.map((entry) => {
    const message = redactAndBoundAttemptEvidenceResult(
      entry.message,
      maxConsoleEvidenceBytes,
    );
    return {
      evidenceId: entry.id,
      ...((message.truncated ||
        Buffer.byteLength(entry.message) > maxConsoleEvidenceBytes) && {
        evidenceTruncated: true,
      }),
      message: message.text,
      pageId: entry.pageId,
      timeMilliseconds: entry.time,
      type: entry.type,
    };
  });
  return {
    ...common,
    coverage: {
      ...listed.coverage,
      returned: selected.length,
      total: preserveUpstreamTotal ? listed.coverage.total : filtered.length,
      truncated: listed.coverage.truncated || filtered.length > selected.length,
    },
    entries,
    status: "available" as const,
    type: target.type,
  };
}
