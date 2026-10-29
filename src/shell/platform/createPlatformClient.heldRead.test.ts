import { afterEach, describe, expect, it, mock, type Mock } from "bun:test";
import { publicContractsV1 } from "@qawolf/api-contracts/v1";

import { createPlatformClient } from "./createPlatformClient.js";
import { timeoutAbortError } from "./slowFetch.testUtils.js";

afterEach(() => {
  mock.restore();
});

const baseUrl = "https://test.qawolf.com";
const apiKey = "qawolf_key";
const noSleep = async (): Promise<void> => {};
const heldInput = { cursor: "c1", sessionId: "sess_1", waitSeconds: 45 };

function failingFetch(error: Error): typeof fetch {
  return mock<typeof fetch>().mockRejectedValue(
    error,
  ) as unknown as typeof fetch;
}

type FetchImpl = (
  url: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function fetchSettledOnlyByAbort(): typeof fetch {
  return mock<FetchImpl>(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError")),
        );
      }),
  ) as unknown as typeof fetch;
}

function callCount(f: typeof fetch): number {
  return (f as unknown as Mock<typeof fetch>).mock.calls.length;
}

function client(f: typeof fetch) {
  return createPlatformClient(apiKey, { baseUrl, fetch: f, sleep: noSleep });
}

describe("a read whose caller owns the retries", () => {
  it("sends a timed-out read once and says it timed out", async () => {
    const f = failingFetch(timeoutAbortError());

    const result = await client(f).callPublicApi(
      publicContractsV1.agent.get,
      heldInput,
      { canRetry: () => false, timeoutMs: 60_000 },
    );

    expect(callCount(f)).toBe(1);
    expect(result).toMatchObject({ ok: false, timedOut: true });
  });

  it("sends a read whose connection failed once", async () => {
    const f = failingFetch(new TypeError("fetch failed"));

    const result = await client(f).callPublicApi(
      publicContractsV1.agent.get,
      heldInput,
      { canRetry: () => false, timeoutMs: 60_000 },
    );

    expect(callCount(f)).toBe(1);
    expect(result).toMatchObject({ ok: false, unreachable: true });
    expect(result).not.toHaveProperty("timedOut");
  });

  it("ends a read in flight when its signal aborts, without retrying it", async () => {
    const f = fetchSettledOnlyByAbort();
    const abort = new AbortController();

    const pending = client(f).callPublicApi(
      publicContractsV1.agent.get,
      heldInput,
      { signal: abort.signal, timeoutMs: 60_000 },
    );
    abort.abort();
    const result = await pending;

    expect(callCount(f)).toBe(1);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("timedOut");
  });

  it("retries a timed-out read by default", async () => {
    const f = failingFetch(timeoutAbortError());

    await client(f).callPublicApi(publicContractsV1.agent.get, heldInput, {
      timeoutMs: 60_000,
    });

    expect(callCount(f)).toBe(3);
  });
});
