import type {
  Bounded,
  TraceActionLog,
} from "~/domains/investigation/parser/trace/playwrightTrace.js";

import { redactAndBoundAttemptEvidenceResult } from "./attemptEvidenceText.js";

const evidenceLimit = 10;
const maxWaitingLogBytes = 512;

export function summarizeAttemptWaitingLogs(
  logs: Bounded<TraceActionLog>,
  actionId: string,
) {
  const matching = logs.items.filter((log) => log.actionId === actionId);
  const selected = matching.slice(-evidenceLimit);
  const bounded = selected.map((log) =>
    redactAndBoundAttemptEvidenceResult(log.message, maxWaitingLogBytes),
  );
  return {
    waitingLogs: bounded.map(({ text }) => text),
    waitingLogsTruncated:
      logs.coverage.incomplete ||
      logs.coverage.truncated ||
      logs.coverage.total > logs.coverage.returned ||
      matching.length > selected.length ||
      bounded.some(({ truncated }) => truncated),
  };
}
