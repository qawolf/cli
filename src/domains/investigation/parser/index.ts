// oxlint-disable eslint/max-lines -- Keep the lazy parser entry's typed dispatch visible in one module.

import type {
  InvestigationRequest,
  InvestigationResult,
} from "~/domains/investigation/types.js";
import {
  inspectExecutionLogs,
  summarizeExecutionLogs,
} from "./executionLogs.js";
import {
  inspectAction,
  inspectActionTimeline,
} from "./projection/inspectAttemptActions.js";
import { type NetworkLog, parseNetworkLog } from "./networkLog/networkLog.js";
import { inspectNetwork } from "./projection/inspectAttemptNetwork.js";
import { inspectSnapshot } from "./projection/inspectAttemptPage.js";
import {
  inspectConsole,
  inspectRequest,
  inspectScreenshot,
} from "./projection/inspectAttemptRecorded.js";
import {
  inspectNetworkLog,
  inspectNetworkLogRequest,
} from "./projection/inspectNetworkLog.js";
import { summarizeNetworkLogErrors } from "./projection/summarizeNetworkLog.js";
import { summarizeAttemptTrace } from "./projection/summarizeAttemptTrace.js";
import { parsePlaywrightTraceArchive } from "./trace/playwrightTrace.js";

function traceUnavailable(
  request: InvestigationRequest,
  traceStatus: string,
): InvestigationResult {
  // Why an iOS attempt has no requests: the log is pending, missing, too large…
  const networkLogStatus = request.artifacts.networkLog?.status;
  return {
    attemptId: request.attempt.attemptId,
    ...(networkLogStatus && { networkLogStatus }),
    status: "unavailable",
    traceStatus,
    type: request.inspect?.type ?? "summary",
  };
}

async function parseTrace(request: InvestigationRequest) {
  const input = request.artifacts.trace;
  return input.status === "available"
    ? parsePlaywrightTraceArchive(Buffer.from(input.bytes))
    : undefined;
}

function parseNetworkLogArtifact(
  request: InvestigationRequest,
): NetworkLog | undefined {
  const input = request.artifacts.networkLog;
  return input?.status === "available"
    ? parseNetworkLog(input.bytes)
    : undefined;
}

function networkFilter(target: NonNullable<InvestigationRequest["inspect"]>) {
  return {
    ...(target.endTimeMilliseconds !== undefined && {
      endTimeMilliseconds: target.endTimeMilliseconds,
    }),
    ...(target.failed === true && { failed: true }),
    limit: target.limit,
    ...(target.method !== undefined && { method: target.method }),
    ...(target.startTimeMilliseconds !== undefined && {
      startTimeMilliseconds: target.startTimeMilliseconds,
    }),
    ...(target.status !== undefined && { status: target.status }),
    type: "network" as const,
    ...(target.urlContains !== undefined && {
      urlContains: target.urlContains,
    }),
  };
}

// iOS attempts have no trace: requests come from the device network log, with
// the log's cursor as request ID and epoch milliseconds as times.
function inspectFromNetworkLog(
  request: InvestigationRequest,
  log: NetworkLog,
): InvestigationResult {
  const target = request.inspect!;
  const common = {
    attemptId: request.attempt.attemptId,
    flowId: request.flowId,
    networkLogStatus:
      log.closed && log.droppedRows === 0
        ? ("ready" as const)
        : ("partial" as const),
    runId: request.runId,
    traceStatus: "not-applicable" as const,
  };
  return target.type === "request"
    ? inspectNetworkLogRequest(log, common, {
        requestId: target.requestId!,
        type: target.type,
      })
    : inspectNetworkLog(log, common, networkFilter(target));
}

async function summarize(
  request: InvestigationRequest,
): Promise<InvestigationResult> {
  const parsed = await parseTrace(request);
  const logs = summarizeExecutionLogs(request.artifacts.logs);
  const traceStatus = parsed?.status ?? request.artifacts.trace.status;
  const networkLog =
    parsed && "trace" in parsed ? undefined : parseNetworkLogArtifact(request);
  const emptyCoverage = {
    incomplete: false,
    malformed: 0,
    returned: 0,
    total: 0,
    truncated: false,
  };
  // A log that exists but was not read (still uploading, too large, link
  // expired) leaves the failed requests unknown. A 404: nothing was captured.
  const networkLogStatus = request.artifacts.networkLog?.status;
  const unread = !["not-captured", "not-found", undefined].includes(
    networkLogStatus,
  );
  const unreadLogCoverage = { ...emptyCoverage, incomplete: unread };
  const traceEvidence =
    parsed && "trace" in parsed
      ? await summarizeAttemptTrace(parsed.trace, request.attempt.error)
      : {
          actions: { coverage: emptyCoverage, items: [] },
          browserConsole: { coverage: emptyCoverage, items: [] },
          failedBrowserActionAttribution: "none",
          networkErrors: networkLog
            ? summarizeNetworkLogErrors(networkLog)
            : { coverage: unreadLogCoverage, items: [] },
        };
  return {
    ...traceEvidence,
    artifactStates: {
      executionLog: logs.artifactState,
      ...(networkLogStatus && { networkLog: networkLogStatus }),
      trace: traceStatus,
    },
    importantExecutionLogs: logs.evidence,
    traceStatus,
  };
}

async function inspect(
  request: InvestigationRequest,
): Promise<InvestigationResult> {
  const target = request.inspect!;
  if (target.type === "log") return inspectExecutionLogs(request);
  const parsed = await parseTrace(request);
  if (!parsed || !("trace" in parsed)) {
    const networkLog = parseNetworkLogArtifact(request);
    if (networkLog && (target.type === "network" || target.type === "request"))
      return inspectFromNetworkLog(request, networkLog);
    return traceUnavailable(
      request,
      parsed?.status ?? request.artifacts.trace.status,
    );
  }
  const common = {
    attemptId: request.attempt.attemptId,
    flowId: request.flowId,
    runId: request.runId,
    traceStatus:
      parsed.status === "incomplete"
        ? ("partial" as const)
        : ("ready" as const),
  };
  switch (target.type) {
    case "action":
      return inspectAction(parsed.trace, common, {
        actionId: target.actionId!,
        type: target.type,
      });
    case "timeline":
      return inspectActionTimeline(parsed.trace, common, {
        limit: target.limit,
        type: target.type,
      });
    case "network":
      return inspectNetwork(parsed.trace, common, networkFilter(target));
    case "request":
      return inspectRequest(parsed.trace, common, {
        requestId: target.requestId!,
        type: target.type,
      });
    case "snapshot": {
      const result = inspectSnapshot(parsed.trace, common, {
        format: target.format,
        snapshotId: target.snapshotId!,
        type: target.type,
      });
      if (!("html" in result) || typeof result.html !== "string") return result;
      const { html, ...metadata } = result;
      return {
        ...metadata,
        binary: {
          bytesBase64: Buffer.from(
            `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; form-action 'none'; frame-src 'none'; img-src data:">${html}`,
          ).toString("base64"),
          extension: "html",
        },
      };
    }
    case "screenshot": {
      const result = await inspectScreenshot(parsed.trace, common, {
        screenshotId: target.screenshotId!,
        type: target.type,
      });
      if (
        !("imageJpegBase64" in result) ||
        typeof result.imageJpegBase64 !== "string"
      )
        return result;
      const { imageJpegBase64, ...metadata } = result;
      return {
        ...metadata,
        binary: { bytesBase64: imageJpegBase64, extension: "jpeg" },
      };
    }
    case "console":
      return inspectConsole(parsed.trace, common, {
        ...(target.endTimeMilliseconds !== undefined && {
          endTimeMilliseconds: target.endTimeMilliseconds,
        }),
        ...(target.evidenceId !== undefined && {
          evidenceId: target.evidenceId,
        }),
        limit: target.limit,
        ...(target.startTimeMilliseconds !== undefined && {
          startTimeMilliseconds: target.startTimeMilliseconds,
        }),
        type: target.type,
      });
  }
}

export async function investigate(
  request: InvestigationRequest,
): Promise<InvestigationResult> {
  return request.mode === "summary" ? summarize(request) : inspect(request);
}
