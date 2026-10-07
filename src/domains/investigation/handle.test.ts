import { afterEach, describe, expect, it, mock } from "bun:test";
import JSZip from "jszip";

import { makeAuthCtx } from "~/shell/commandContext.testUtils.js";
import { attemptArtifactsFixture } from "./attemptArtifacts.fixtures.js";
import {
  handleInvestigationInspect,
  handleInvestigationSummary,
} from "./handle.js";

const originalFetch = globalThis.fetch;
const actionId = "trace.trace#0:action:call@1";

afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function failedClickTrace(): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file(
    "trace.trace",
    [
      { type: "context-options" },
      {
        callId: "call@1",
        class: "Frame",
        method: "click",
        params: { selector: "internal:role=button" },
        startTime: 1,
        type: "before",
      },
      {
        callId: "call@1",
        endTime: 2,
        error: { message: "Click failed" },
        type: "after",
      },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n") + "\n",
  );
  return zip.generateAsync({ type: "uint8array" });
}

function serveArtifacts(trace: Response) {
  const fetchMock = mock(async (input: string | URL | Request) => {
    const url = input instanceof Request ? input.url : String(input);
    return url.includes("trace.zip") ? trace : new Response("");
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("handleInvestigationSummary", () => {
  it("summarizes the trace without echoing the signed artifact URLs", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: attemptArtifactsFixture(),
    });
    serveArtifacts(new Response(await failedClickTrace()));

    const result = await handleInvestigationSummary(ctx, "attempt-1");

    expect(result).toBeUndefined();
    expect(callPublicApi.mock.calls[0]?.[1]).toEqual({
      attemptId: "attempt-1",
    });
    expect(outputs()[0]?.data).toMatchObject({
      evidence: {
        actions: {
          items: [{ actionId, error: "Click failed" }],
        },
        traceStatus: "ready",
      },
      runId: "run-1",
    });
    expect(JSON.stringify(outputs()[0]?.data)).not.toContain("token=secret");
  });

  it("returns the API failure without downloading anything", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({ error: "Attempt not found", ok: false });
    const fetchMock = serveArtifacts(new Response(""));

    const result = await handleInvestigationSummary(ctx, "attempt-1");

    expect(result).toEqual({ error: "Attempt not found" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(outputs()).toEqual([]);
  });
});

describe("handleInvestigationInspect", () => {
  it("returns one action from the trace", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: attemptArtifactsFixture(),
    });
    serveArtifacts(new Response(await failedClickTrace()));

    const result = await handleInvestigationInspect(ctx, {
      actionId,
      attemptId: "attempt-1",
      format: "text",
      type: "action",
    });

    expect(result).toBeUndefined();
    expect(outputs()[0]?.data).toMatchObject({
      action: { actionId },
      status: "available",
      traceStatus: "ready",
    });
  });

  it("reports an expired trace URL as unavailable", async () => {
    const { callPublicApi, ctx, outputs } = makeAuthCtx("json");
    callPublicApi.mockResolvedValue({
      ok: true,
      value: attemptArtifactsFixture(),
    });
    serveArtifacts(new Response("", { status: 403 }));

    const result = await handleInvestigationInspect(ctx, {
      actionId,
      attemptId: "attempt-1",
      format: "text",
      type: "action",
    });

    expect(result).toBeUndefined();
    expect(outputs()[0]?.data).toEqual({
      attemptId: "attempt-1",
      status: "unavailable",
      traceStatus: "expired-url",
      type: "action",
    });
  });
});
