import type { AttemptArtifacts } from "./handle.js";

export function attemptArtifactsFixture(): AttemptArtifacts {
  return {
    artifactStatus: "signed",
    artifacts: {
      logsUrl: "https://storage.invalid/logs.txt?token=secret",
      traceUrl: "https://storage.invalid/trace.zip?token=secret",
    },
    attempt: {
      attemptId: "attempt-1",
      createdAt: "2026-09-29T00:00:00.000Z",
      kind: "automated",
      status: "failed",
    },
    flowId: "flow-1",
    flowStatus: "failed",
    retryContext: { currentOrdinal: 1, total: 1 },
    runId: "run-1",
    runStatus: "failed",
  };
}
