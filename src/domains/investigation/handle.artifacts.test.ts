import { afterEach, describe, expect, it, mock } from "bun:test";

import { attemptArtifactsFixture as fixture } from "./attemptArtifacts.fixtures.js";
import { loadInspectArtifact, loadSummaryArtifacts } from "./handle.js";

const originalFetch = globalThis.fetch;

function requestUrl(input: string | URL | Request): string {
  return input instanceof Request ? input.url : String(input);
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

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

    await loadInspectArtifact(fixture(), "console");

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
      "https://storage.invalid/network.ndjson?token=secret",
      "https://storage.invalid/trace.zip?token=secret",
    ]);
  });

  it("reads requests from the network log only when the trace is missing", async () => {
    const requested: string[] = [];
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = requestUrl(input);
      requested.push(url);
      return new Response("", { status: url.includes("trace") ? 404 : 200 });
    }) as unknown as typeof fetch;

    const network = await loadInspectArtifact(fixture(), "network");
    await loadInspectArtifact(fixture(), "console");

    expect(network.networkLog?.status).toBe("available");
    expect(requested).toEqual([
      "https://storage.invalid/trace.zip?token=secret",
      "https://storage.invalid/network.ndjson?token=secret",
      "https://storage.invalid/trace.zip?token=secret",
    ]);
  });

  it("keeps a 404 network log pending for 2 minutes after the attempt", async () => {
    globalThis.fetch = mock(
      async () => new Response("", { status: 404 }),
    ) as unknown as typeof fetch;
    const value = fixture();
    if (value.artifactStatus !== "signed") throw new Error("signed fixture");
    value.attempt.completedAt = "2026-09-29T00:10:00.000Z";
    const ended = Date.parse(value.attempt.completedAt);

    const soon = await loadSummaryArtifacts(value, ended + 60_000);
    const later = await loadSummaryArtifacts(value, ended + 180_000);
    expect(soon.networkLog?.status).toBe("pending");
    expect(later.networkLog?.status).toBe("not-found");
  });
});
