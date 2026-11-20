import { describe, expect, it } from "bun:test";
import JSZip from "jszip";

import type { InvestigationRequest } from "~/domains/investigation/types.js";

import { investigate } from "./index.js";
import {
  networkLogFixture,
  networkLogRow,
  networkLogSummaryRow,
  toNdjson,
} from "./networkLog/networkLog.fixtures.js";

function iosRequest(
  inspect?: Partial<NonNullable<InvestigationRequest["inspect"]>>,
  rows = networkLogFixture(),
): InvestigationRequest {
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
    ...(inspect
      ? {
          inspect: { format: "text", limit: 20, type: "network", ...inspect },
          mode: "inspect",
        }
      : { mode: "summary" }),
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

  it("filters network requests by failure, method and time", async () => {
    const result = await investigate(
      iosRequest({
        failed: true,
        method: "post",
        startTimeMilliseconds: Date.parse("2026-11-20T09:00:04.000Z"),
      }),
    );

    expect(result).toMatchObject({
      coverage: { returned: 1, total: 1 },
      networkLogStatus: "ready",
      status: "available",
      traceStatus: "not-applicable",
    });
    expect(result["entries"]).toEqual([
      expect.objectContaining({ requestId: "a1.5", status: 403 }),
    ]);
  });

  it("returns one request with its headers and bodies", async () => {
    const result = await investigate(
      iosRequest({ requestId: "a1.5", type: "request" }),
    );

    expect(result).toMatchObject({
      body: { status: "available", text: '{"error":"forbidden"}' },
      request: {
        requestHeaders: { "x-request-id": "req-5" },
        responseHeaders: { "content-type": "application/json" },
        status: 403,
      },
      requestBody: { status: "available", text: "{}" },
      status: "available",
    });
    expect(JSON.stringify(result)).not.toContain("synthetic-secret");
  });

  it("keeps the trace answer for other evidence and for no network log", async () => {
    const timeline = await investigate(iosRequest({ type: "timeline" }));
    const withoutLog = iosRequest({});
    withoutLog.artifacts.networkLog = { status: "pending" };

    expect(timeline).toMatchObject({ status: "unavailable" });
    expect(await investigate(withoutLog)).toMatchObject({
      networkLogStatus: "pending",
      status: "unavailable",
      traceStatus: "not-found",
    });
  });

  it("lists other failures before app cancels", async () => {
    const cancels = Array.from({ length: 11 }, (_, index) =>
      networkLogRow({ err: "context canceled", seq: 10 + index, status: 0 }),
    );
    const noStart = networkLogRow({ seq: 2, startedAt: "", status: 404 });
    const rows = [networkLogRow({ seq: 1, status: 500 }), ...cancels, noStart];
    const result = await investigate(iosRequest(undefined, rows));

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

describe("--failed on a trace", () => {
  it("keeps requests with no response, status 400 or more, or a failure", async () => {
    const zip = new JSZip();
    zip.file("trace.trace", JSON.stringify({ type: "context-options" }) + "\n");
    const resource = (url: string, response: Record<string, unknown>) =>
      JSON.stringify({
        snapshot: { request: { method: "GET", url }, response },
        type: "resource-snapshot",
      });
    zip.file(
      "trace.network",
      [
        resource("https://app.test/ok", { status: 200 }),
        resource("https://app.test/denied", { status: 403 }),
        resource("https://app.test/reset", { _failureText: "net::ERR_RESET" }),
      ].join("\n") + "\n",
    );
    const result = await investigate({
      artifacts: {
        logs: { status: "not-captured" },
        trace: {
          bytes: await zip.generateAsync({ type: "uint8array" }),
          offset: 0,
          status: "available",
        },
      },
      attempt: { attemptId: "attempt-1", status: "failed" },
      flowId: "flow-1",
      inspect: { failed: true, format: "text", limit: 20, type: "network" },
      mode: "inspect",
      runId: "run-1",
    });

    expect(
      (result["entries"] as { url: string }[]).map((entry) => entry.url),
    ).toEqual(["https://app.test/denied", "https://app.test/reset"]);
  });
});
