import type {
  ArtifactInput,
  InvestigationRequest,
} from "../domains/investigation/types.js";
import { redactAttemptEvidence } from "./projection/attemptEvidenceText.js";
import { parseRunLogs } from "./trace/runLogs.js";

type PublicLog = {
  evidenceId: string;
  message: string;
  severity: string;
  source: "qawolfTraceCollection" | "serverConsole";
  timestamp: string;
};

const emptyCoverage = {
  incomplete: false,
  malformed: 0,
  returned: 0,
  total: 0,
  truncated: false,
};

function parseExecutionLogs(input: ArtifactInput) {
  if (input.status !== "available")
    return {
      coverage: emptyCoverage,
      items: [] as PublicLog[],
      status: input.status,
    };
  const firstNewline = input.offset > 0 ? input.bytes.indexOf(0x0a) : -1;
  const skipped = firstNewline === -1 ? 0 : firstNewline + 1;
  const parsed = parseRunLogs(Buffer.from(input.bytes.subarray(skipped)));
  const records = "logs" in parsed ? parsed.logs.records : [];
  const items = records.flatMap((record) => {
    const source =
      record.source === "serverConsole"
        ? ("serverConsole" as const)
        : record.source === "qawolf" &&
            /playwright trace|tracing on context/i.test(record.message)
          ? ("qawolfTraceCollection" as const)
          : undefined;
    return source
      ? [
          {
            evidenceId: `log:${input.offset + skipped + record.byteOffset}`,
            message: redactAttemptEvidence(record.message),
            severity: record.severity,
            source,
            timestamp: record.timestamp,
          },
        ]
      : [];
  });
  const incomplete = input.offset > 0 || parsed.status === "incomplete";
  return {
    coverage:
      "logs" in parsed
        ? {
            ...parsed.logs.coverage,
            incomplete,
            total: items.length,
            returned: items.length,
            truncated: incomplete || parsed.logs.coverage.truncated,
          }
        : emptyCoverage,
    items,
    status: incomplete
      ? "incomplete"
      : parsed.status === "ready"
        ? "available"
        : parsed.status,
  };
}

export function inspectExecutionLogs(request: InvestigationRequest) {
  const target = request.inspect!;
  const parsed = parseExecutionLogs(request.artifacts.logs);
  const matching = parsed.items.filter(
    (record) =>
      (target.evidenceId === undefined ||
        record.evidenceId === target.evidenceId) &&
      (target.source === undefined || record.source === target.source) &&
      (target.startTimestamp === undefined ||
        Date.parse(record.timestamp) >= Date.parse(target.startTimestamp)) &&
      (target.endTimestamp === undefined ||
        Date.parse(record.timestamp) <= Date.parse(target.endTimestamp)),
  );
  const entries = matching.slice(-target.limit);
  return {
    attemptId: request.attempt.attemptId,
    coverage: {
      ...parsed.coverage,
      returned: entries.length,
      total: matching.length,
      truncated: parsed.coverage.truncated || matching.length > entries.length,
    },
    entries,
    logStatus: parsed.status,
    status: entries.length ? "available" : "not-found",
    traceStatus: "unchecked",
    type: "log",
  };
}

export function summarizeExecutionLogs(input: ArtifactInput) {
  const parsed = parseExecutionLogs(input);
  const selected = parsed.items
    .filter(
      (record) =>
        record.source === "qawolfTraceCollection" ||
        record.severity === "error",
    )
    .slice(-20);
  return {
    artifactState: parsed.status,
    evidence: {
      coverage: {
        ...parsed.coverage,
        returned: selected.length,
        total: parsed.items.length,
        truncated:
          parsed.coverage.truncated || selected.length < parsed.items.length,
      },
      items: selected,
    },
  };
}
