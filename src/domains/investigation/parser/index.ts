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
import { inspectNetwork } from "./projection/inspectAttemptNetwork.js";
import { inspectSnapshot } from "./projection/inspectAttemptPage.js";
import {
  inspectConsole,
  inspectRequest,
  inspectScreenshot,
} from "./projection/inspectAttemptRecorded.js";
import { summarizeAttemptTrace } from "./projection/summarizeAttemptTrace.js";
import { parsePlaywrightTraceArchive } from "./trace/playwrightTrace.js";

function traceUnavailable(
  request: InvestigationRequest,
  traceStatus: string,
): InvestigationResult {
  return {
    attemptId: request.attempt.attemptId,
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

async function summarize(
  request: InvestigationRequest,
): Promise<InvestigationResult> {
  const parsed = await parseTrace(request);
  const logs = summarizeExecutionLogs(request.artifacts.logs);
  const traceStatus = parsed?.status ?? request.artifacts.trace.status;
  const emptyCoverage = {
    incomplete: false,
    malformed: 0,
    returned: 0,
    total: 0,
    truncated: false,
  };
  const traceEvidence =
    parsed && "trace" in parsed
      ? await summarizeAttemptTrace(parsed.trace, request.attempt.error)
      : {
          actions: { coverage: emptyCoverage, items: [] },
          browserConsole: { coverage: emptyCoverage, items: [] },
          failedBrowserActionAttribution: "none",
          networkErrors: { coverage: emptyCoverage, items: [] },
        };
  return {
    ...traceEvidence,
    artifactStates: { executionLog: logs.artifactState, trace: traceStatus },
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
  if (!parsed || !("trace" in parsed))
    return traceUnavailable(
      request,
      parsed?.status ?? request.artifacts.trace.status,
    );
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
      return inspectNetwork(parsed.trace, common, {
        ...(target.endTimeMilliseconds !== undefined && {
          endTimeMilliseconds: target.endTimeMilliseconds,
        }),
        limit: target.limit,
        ...(target.method !== undefined && { method: target.method }),
        ...(target.startTimeMilliseconds !== undefined && {
          startTimeMilliseconds: target.startTimeMilliseconds,
        }),
        ...(target.status !== undefined && { status: target.status }),
        type: target.type,
        ...(target.urlContains !== undefined && {
          urlContains: target.urlContains,
        }),
      });
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
