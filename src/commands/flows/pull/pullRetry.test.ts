import { describe, expect, it } from "bun:test";

import { testApiKey, testBaseUrl } from "./pull.fixtures.js";
import { requestBundle } from "./pull.js";

async function expectRejects(
  promise: Promise<unknown>,
  pattern?: RegExp,
): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(Error);
  if (pattern) expect((caught as Error).message).toMatch(pattern);
}

function makeSequentialFetch(responses: (Response | Error)[]): {
  fetch: typeof globalThis.fetch;
  callCount: () => number;
} {
  let i = 0;
  const handler = async (): Promise<Response> => {
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    if (r instanceof Error) throw r;
    if (r === undefined) throw new Error("test: no response configured");
    return r;
  };
  return {
    fetch: handler as unknown as typeof globalThis.fetch,
    callCount: () => i,
  };
}

function trpcSuccessResponse(): Response {
  const body = {
    result: {
      data: {
        json: {
          url: "https://gcs.example.com/x",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      },
    },
  };
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

const noSleep = async (): Promise<void> => {};

describe("requestBundle retry", () => {
  it("retries on a network error and returns success on the second attempt", async () => {
    const seq = makeSequentialFetch([
      new TypeError("fetch failed"),
      trpcSuccessResponse(),
    ]);

    const result = await requestBundle(
      {
        apiKey: testApiKey,
        baseUrl: testBaseUrl,
        fetch: seq.fetch,
        sleep: noSleep,
      },
      "env-abc",
    );

    expect(result.signedUrl).toBe("https://gcs.example.com/x");
    expect(seq.callCount()).toBe(2);
  });

  it("gives up after 3 network failures", async () => {
    const seq = makeSequentialFetch([
      new TypeError("fetch failed"),
      new TypeError("fetch failed"),
      new TypeError("fetch failed"),
    ]);

    await expectRejects(
      requestBundle(
        {
          apiKey: testApiKey,
          baseUrl: testBaseUrl,
          fetch: seq.fetch,
          sleep: noSleep,
        },
        "env-abc",
      ),
      /Could not reach the QA Wolf API/i,
    );
    expect(seq.callCount()).toBe(3);
  });

  it("does not retry on an HTTP error (4xx is deterministic)", async () => {
    const seq = makeSequentialFetch([
      new Response("not found", { status: 404 }),
      trpcSuccessResponse(),
    ]);

    await expectRejects(
      requestBundle(
        {
          apiKey: testApiKey,
          baseUrl: testBaseUrl,
          fetch: seq.fetch,
          sleep: noSleep,
        },
        "env-abc",
      ),
      /could not find that environment|--env/i,
    );
    expect(seq.callCount()).toBe(1);
  });
});
