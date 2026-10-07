// oxlint-disable eslint/max-lines -- Keep shared typed fallback and action shaping aligned with the platform implementation.

import type { listTraceActionLogs } from "~/domains/investigation/parser/trace/playwrightTrace.js";
import type {
  PlaywrightTrace,
  TraceAction,
} from "~/domains/investigation/parser/trace/playwrightTrace.js";
import { readTraceActionStack } from "~/domains/investigation/parser/trace/playwrightTrace.js";

import { redactAndBoundAttemptEvidenceResult } from "./attemptEvidenceText.js";

const maxActionEvidenceBytes = 512;

export type InspectionCommon = {
  attemptId: string;
  flowId: string;
  runId: string;
  traceStatus:
    | "unchecked"
    | "ready"
    | "partial"
    | "missing"
    | "malformed"
    | "storage-unavailable"
    | "not-applicable";
};

export const emptyInspectionCoverage = {
  incomplete: false,
  malformed: 0,
  returned: 0,
  total: 0,
  truncated: false,
};

export function shapeInspectionAction(
  trace: PlaywrightTrace,
  action: TraceAction,
  logs: ReturnType<typeof listTraceActionLogs>["items"],
) {
  const stack = readTraceActionStack(trace, action).map(
    (frame) => `${frame.file}:${frame.compiledLine}`,
  );
  const waitingLogs = logs.filter((log) => log.actionId === action.id);
  const error = action.errorMessage
    ? redactAndBoundAttemptEvidenceResult(
        action.errorMessage,
        maxActionEvidenceBytes,
      )
    : undefined;
  const selector = action.selector
    ? redactAndBoundAttemptEvidenceResult(
        action.selector,
        maxActionEvidenceBytes,
      )
    : undefined;
  const boundedWaitingLogs = waitingLogs
    .slice(-20)
    .map((log) =>
      redactAndBoundAttemptEvidenceResult(log.message, maxActionEvidenceBytes),
    );
  const evidenceTruncated =
    (action.errorMessage !== undefined &&
      Buffer.byteLength(action.errorMessage) > maxActionEvidenceBytes) ||
    (action.selector !== undefined &&
      Buffer.byteLength(action.selector) > maxActionEvidenceBytes) ||
    waitingLogs
      .slice(-20)
      .some(
        ({ message }) => Buffer.byteLength(message) > maxActionEvidenceBytes,
      ) ||
    error?.truncated === true ||
    selector?.truncated === true ||
    boundedWaitingLogs.some(({ truncated }) => truncated);
  return {
    actionId: action.id,
    apiName: action.apiName,
    ...(action.endTime !== undefined && {
      endedAtMilliseconds: action.endTime,
    }),
    ...(error && { error: error.text }),
    ...(evidenceTruncated && { evidenceTruncated: true }),
    ...(selector && { selector: selector.text }),
    stack: stack.slice(0, 20),
    stackTruncated: stack.length > 20,
    ...(action.startTime !== undefined && {
      startedAtMilliseconds: action.startTime,
    }),
    streamId: action.streamId,
    waitingLogs: boundedWaitingLogs.map(({ text }) => text),
    waitingLogsTruncated:
      waitingLogs.length > 20 ||
      waitingLogs.some(
        ({ message }) => Buffer.byteLength(message) > maxActionEvidenceBytes,
      ) ||
      boundedWaitingLogs.some(({ truncated }) => truncated),
  };
}
