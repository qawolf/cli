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

function callCount(f: typeof fetch): number {
  return (f as unknown as Mock<typeof fetch>).mock.calls.length;
}

function client(f: typeof fetch) {
  return createPlatformClient(apiKey, { baseUrl, fetch: f, sleep: noSleep });
}

describe("a read that asked not to retry its timeouts", () => {
  it("sends a timed-out read once and says it timed out", async () => {
    const f = failingFetch(timeoutAbortError());

    const result = await client(f).callPublicApi(
      publicContractsV1.agent.get,
      heldInput,
      { retryTimeouts: false, timeoutMs: 60_000 },
    );

    expect(callCount(f)).toBe(1);
    expect(result).toMatchObject({ ok: false, timedOut: true });
  });

  it("still retries a connection that failed", async () => {
    const f = failingFetch(new TypeError("fetch failed"));

    const result = await client(f).callPublicApi(
      publicContractsV1.agent.get,
      heldInput,
      { retryTimeouts: false, timeoutMs: 60_000 },
    );

    expect(callCount(f)).toBe(3);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("timedOut");
  });

  it("stops retrying once the caller says another attempt would not fit", async () => {
    const f = failingFetch(new TypeError("fetch failed"));

    await client(f).callPublicApi(publicContractsV1.agent.get, heldInput, {
      canRetry: () => false,
      retryTimeouts: false,
      timeoutMs: 60_000,
    });

    expect(callCount(f)).toBe(1);
  });

  it("retries a timed-out read by default", async () => {
    const f = failingFetch(timeoutAbortError());

    await client(f).callPublicApi(publicContractsV1.agent.get, heldInput, {
      timeoutMs: 60_000,
    });

    expect(callCount(f)).toBe(3);
  });
});
