import { afterEach, describe, expect, it, mock } from "bun:test";

import {
  type AttemptArtifacts,
  loadInspectArtifact,
  loadSummaryArtifacts,
} from "./handle.js";

const originalFetch = globalThis.fetch;

function requestUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : String(input);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function fixture(): AttemptArtifacts {
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

describe("investigation artifact selection", () => {
  it("downloads only logs for log inspection", async () => {
    const requested: string[] = [];
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requested.push(requestUrl(input));
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;

    await loadInspectArtifact(fixture(), "log");

    expect(requested).toEqual([
      "https://storage.invalid/logs.txt?token=secret",
    ]);
  });

  it("downloads only trace for non-log inspection", async () => {
    const requested: string[] = [];
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requested.push(requestUrl(input));
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;

    await loadInspectArtifact(fixture(), "timeline");

    expect(requested).toEqual([
      "https://storage.invalid/trace.zip?token=secret",
    ]);
  });

  it("downloads both artifacts for a summary", async () => {
    const requested: string[] = [];
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requested.push(requestUrl(input));
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;

    await loadSummaryArtifacts(fixture());

    expect(requested.sort()).toEqual([
      "https://storage.invalid/logs.txt?token=secret",
      "https://storage.invalid/trace.zip?token=secret",
    ]);
  });
});
