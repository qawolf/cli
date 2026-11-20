import { describe, expect, it } from "bun:test";

import type { InvestigationRequest } from "~/domains/investigation/types.js";

import { investigate } from "./index.js";
import {
  networkLogFixture,
  networkLogSummaryRow,
  toNdjson,
} from "./networkLog/networkLog.fixtures.js";

function iosRequest(): InvestigationRequest {
  return {
    artifacts: {
      logs: { status: "not-captured" },
      networkLog: {
        bytes: toNdjson([...networkLogFixture(), networkLogSummaryRow]),
        offset: 0,
        status: "available",
      },
      trace: { status: "not-found" },
    },
    attempt: { attemptId: "attempt-1", status: "failed" },
    flowId: "flow-1",
    mode: "summary",
    runId: "run-1",
  };
}

describe("investigation of an attempt with a network log and no trace", () => {
  it("summarizes failed requests with their reason", async () => {
    const result = await investigate(iosRequest());

    expect(result["artifactStates"]).toEqual({
      executionLog: "not-captured",
      networkLog: "available",
      trace: "not-found",
    });
    expect(result["networkErrors"]).toEqual({
      coverage: {
        incomplete: false,
        malformed: 0,
        returned: 3,
        total: 3,
        truncated: false,
      },
      items: [
        expect.objectContaining({
          failureReason: "canceled",
          requestId: "a1.3",
        }),
        expect.objectContaining({
          failureReason: "http-error",
          method: "POST",
          requestId: "a1.5",
          status: 403,
        }),
        expect.objectContaining({
          failureReason: "connection-failed",
          requestId: "a1.6",
        }),
      ],
    });
  });
});
