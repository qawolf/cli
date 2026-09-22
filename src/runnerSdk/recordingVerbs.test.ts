import { describe, expect, it, mock } from "bun:test";
import superjson from "superjson";

import { createRunnerSdk } from "./index.js";
import type { Recorded, Recordings } from "./types.js";

const recordingId = "c41f0990-89d7-44db-a940-2e5425954b29";
const url = "https://app.qawolf.com/runners/ci";

function requestText(value: unknown): string {
  if (typeof value !== "string")
    throw Error("Expected a string request URL or body");
  return value;
}

function decodeRequest(value: unknown): unknown {
  return superjson.parse(requestText(value));
}

function sdkAnswering(answer: unknown, status = 200) {
  const fetch = mock<typeof globalThis.fetch>().mockResolvedValue(
    new Response(
      JSON.stringify(
        status === 200
          ? { result: { data: superjson.serialize(answer) } }
          : { error: { message: "Not found" } },
      ),
      {
        status,
        headers: { "content-type": "application/json" },
      },
    ),
  );
  return {
    fetch,
    sdk: createRunnerSdk({
      apiKey: "test-key",
      baseUrl: "https://test.qawolf.com",
      fetch: fetch as unknown as typeof globalThis.fetch,
    }),
  };
}

describe("recording SDK over the public API", () => {
  it("preserves nested runner refusals and the history URL", async () => {
    const answer: Recorded = {
      result: { outcome: "failure", failureReason: "recording-in-progress" },
      url,
    };
    const { sdk, fetch } = sdkAnswering(answer);
    const result = await sdk.record({
      runnerId: "ci",
      command: { action: "start", recordingId },
    });
    expect(result).toEqual({ ok: true, value: answer });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetch.mock.calls[0]!;
    expect(requestText(requestUrl)).toEndWith("/api/trpc/public.runner.record");
    expect(init?.method).toBe("POST");
    expect(decodeRequest(init?.body)).toEqual({
      id: "ci",
      command: { action: "start", recordingId },
    });
  });

  it.each([
    { action: "stop", recordingId },
    { action: "status" },
    { action: "auto", enabled: false },
  ] as const)(
    "sends recording controls without launching anything",
    async (command) => {
      const answer: Recorded = {
        result: { outcome: "success", state: { auto: "off" } },
        url,
      };
      const { sdk, fetch } = sdkAnswering(answer);
      expect(await sdk.record({ runnerId: "ci", command })).toEqual({
        ok: true,
        value: answer,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(decodeRequest(fetch.mock.calls[0]?.[1]?.body)).toEqual({
        id: "ci",
        command,
      });
    },
  );

  it("returns opaque pagination and links from history without a live runner request", async () => {
    const answer: Recordings = {
      nextPageToken: "next-page",
      recordings: [
        {
          id: recordingId,
          runnerId: "ci",
          runnerInstanceId: recordingId,
          mode: "manual",
          status: "ready",
          runIds: ["run-1"],
          version: 1,
          startedAt: "2026-09-22T12:00:00.000Z",
          endedAt: "2026-09-22T12:01:00.000Z",
          url,
          videoUrl: "https://example.com/video.mp4",
        },
      ],
    };
    const { sdk, fetch } = sdkAnswering(answer);
    expect(
      await sdk.recordings({
        runnerId: "ci",
        recordingId,
        pageToken: "page/+=1",
      }),
    ).toEqual({ ok: true, value: answer });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [requestUrl, init] = fetch.mock.calls[0]!;
    expect(init?.method).toBe("GET");
    const target = new URL(requestText(requestUrl));
    expect(target.pathname).toBe("/api/trpc/public.runner.recordings");
    expect(decodeRequest(target.searchParams.get("input"))).toEqual({
      id: "ci",
      recordingId,
      pageToken: "page/+=1",
    });
  });

  it("rejects malformed UUIDs without network I/O", async () => {
    const { sdk, fetch } = sdkAnswering({});
    expect(
      (
        await sdk.record({
          runnerId: "ci",
          command: { action: "stop", recordingId: "bad" },
        })
      ).ok,
    ).toBe(false);
    expect(
      (await sdk.recordings({ runnerId: "ci", recordingId: "bad" })).ok,
    ).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not advise launching a runner when history is unavailable", async () => {
    const { sdk } = sdkAnswering({}, 404);
    const result = await sdk.recordings({ runnerId: "ci" });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("not running");
    expect(JSON.stringify(result)).not.toContain("runner launch");
  });
});
