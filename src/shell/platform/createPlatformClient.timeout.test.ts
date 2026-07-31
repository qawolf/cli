import { afterEach, describe, expect, it, mock, type Mock } from "bun:test";

import { createPlatformClient } from "./createPlatformClient.js";
import {
  makeTimingOutBodyFetch,
  timeoutAbortError,
} from "./slowFetch.testUtils.js";

afterEach(() => {
  mock.restore();
});

const baseUrl = "https://test.qawolf.com";
const apiKey = "qawolf_key";
const noSleep = async (): Promise<void> => {};

function callCount(f: typeof fetch): number {
  return (f as unknown as Mock<typeof fetch>).mock.calls.length;
}

describe("a request that reached its deadline", () => {
  // As transient as a refused connection, so it is retried — but reported as the
  // wait it was rather than as a host that could not be reached, which would
  // send the caller to look at their network.
  it("is retried, then reported as a timeout naming how long it waited", async () => {
    const f = mock<typeof fetch>().mockRejectedValue(
      timeoutAbortError(),
    ) as unknown as typeof fetch;

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
      sleep: noSleep,
    }).getIdentity();

    expect(callCount(f)).toBe(3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/did not answer within 10s/);
  });

  // Identity answers its headers first, so this is the deadline landing while the
  // body is still arriving — retried like any other timeout, not read as a team
  // the API described in a shape we did not recognize.
  it("is retried and named a timeout when the body is what ran out of time", async () => {
    const f = makeTimingOutBodyFetch();

    const result = await createPlatformClient(apiKey, {
      fetch: f,
      baseUrl,
      sleep: noSleep,
    }).getIdentity();

    expect(callCount(f)).toBe(3);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/did not answer within 10s/);
  });
});
