import { afterEach, describe, expect, it, mock } from "bun:test";

import { makeAuthCtx } from "~/shell/commandContext.testUtils.js";
import { handleInvestigationInspect } from "./handle.js";

const originalFetch = globalThis.fetch;
const actionId = "trace.trace#0:action:call@1";

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("handleInvestigationInspect --timeline", () => {
  const timeline = {
    actions: [
      {
        actionId,
        apiName: "locator.click",
        endedAtMilliseconds: 2,
        error: "Click failed",
        selector: "internal:role=button",
        stack: [],
        stackTruncated: false,
        startedAtMilliseconds: 1,
        streamId: "trace.trace#0",
        waitingLogs: [],
        waitingLogsTruncated: false,
      },
    ],
    attemptId: "attempt-1",
    coverage: {
      incomplete: false,
      malformed: 0,
      returned: 1,
      total: 2,
      truncated: true,
    },
    flowId: "flow-1",
    nextBeforeActionId: actionId,
    runId: "run-1",
    status: "available",
    traceStatus: "ready",
    type: "timeline",
  };

  it("prints the platform's timeline without downloading the trace", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({ ok: true, value: timeline });
    const fetchMock = mock(async () => new Response(""));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await handleInvestigationInspect(ctx, {
      attemptId: "attempt-1",
      format: "text",
      type: "timeline",
    });

    expect(result).toBeUndefined();
    expect(callPublicApi).toHaveBeenCalledTimes(1);
    expect(callPublicApi.mock.calls[0]?.[0].name).toBe("attempt.listActions");
    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      attemptId: "attempt-1",
      limit: 20,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(outputs()[0]?.data).toEqual(timeline);
  });

  it("sends --limit and --before-action as the page to read", async () => {
    const { callPublicApi, ctx } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({ ok: true, value: timeline });

    await handleInvestigationInspect(ctx, {
      attemptId: "attempt-1",
      beforeAction: actionId,
      format: "text",
      limit: "5",
      type: "timeline",
    });

    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      attemptId: "attempt-1",
      beforeActionId: actionId,
      limit: 5,
    });
  });

  it.each([
    "not-captured",
    "expired",
    "not-found",
    "pending",
    "too-large",
    "malformed",
    "unavailable",
  ] as const)(
    "prints a %s trace as an unavailable answer",
    async (traceStatus) => {
      const unavailable = {
        attemptId: "attempt-1",
        status: "unavailable",
        traceStatus,
        type: "timeline",
      };
      const { callPublicApi, ctx, outputs } = makeAuthCtx("json");
      callPublicApi.mockResolvedValue({ ok: true, value: unavailable });

      const result = await handleInvestigationInspect(ctx, {
        attemptId: "attempt-1",
        format: "text",
        type: "timeline",
      });

      expect(result).toBeUndefined();
      expect(outputs()[0]?.data).toEqual(unavailable);
    },
  );

  it("returns an access refusal as the command's error", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({ error: "Attempt not found", ok: false });

    const result = await handleInvestigationInspect(ctx, {
      attemptId: "attempt-1",
      format: "text",
      type: "timeline",
    });

    expect(result).toEqual({ error: "Attempt not found" });
    expect(outputs()).toEqual([]);
  });
});
