import { describe, expect, it } from "bun:test";

import type { InvestigationRequest } from "~/domains/investigation/types.js";

import { investigate } from "./index.js";
import {
  networkLogFixture,
  networkLogRow,
  networkLogSummaryRow,
  toNdjson,
} from "./networkLog/networkLog.fixtures.js";

function iosRequest(rows = networkLogFixture()): InvestigationRequest {
  return {
    artifacts: {
      logs: { status: "not-captured" },
      networkLog: {
        bytes: toNdjson([...rows, networkLogSummaryRow]),
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

  it("lists other failures before app cancels", async () => {
    const cancels = Array.from({ length: 11 }, (_, index) =>
      networkLogRow({ err: "context canceled", seq: 10 + index, status: 0 }),
    );
    const noStart = networkLogRow({ seq: 2, startedAt: "", status: 404 });
    const rows = [networkLogRow({ seq: 1, status: 500 }), ...cancels, noStart];
    const result = await investigate(iosRequest(rows));

    const { coverage, items } = result["networkErrors"] as {
      coverage: unknown;
      items: { status: number }[];
    };
    expect(coverage).toMatchObject({ total: 13, truncated: true });
    const statuses = items.map((item) => item.status).join(" ");
    expect(statuses).toBe("404 500 0 0 0 0 0 0 0 0");
  });

  it("marks the failed requests unknown while the log is not read", async () => {
    const coverageFor = async (status: "not-found" | "pending") => {
      const request = iosRequest();
      request.artifacts.networkLog = { status };
      const result = await investigate(request);
      return (result["networkErrors"] as { coverage: unknown }).coverage;
    };

    expect(await coverageFor("pending")).toMatchObject({ incomplete: true });
    expect(await coverageFor("not-found")).toMatchObject({ incomplete: false });
  });
});
