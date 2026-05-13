import { describe, expect, it } from "bun:test";

import { makeFakeFetch, testApiKey, testBaseUrl } from "./pull.fixtures.js";
import { requestBundle } from "./pull.js";
import { expectRejects } from "./pull.testUtils.js";

const noSleep = async (): Promise<void> => {};
const deps = (fetch: typeof globalThis.fetch) => ({
  apiKey: testApiKey,
  baseUrl: testBaseUrl,
  fetch,
  sleep: noSleep,
});

describe("requestBundle retry", () => {
  it("retries on a network error and returns success on the second attempt", async () => {
    const fakeFetch = makeFakeFetch([
      { kind: "networkError", error: new TypeError("fetch failed") },
      { kind: "ok", sourceArchive: "/dev/null" },
    ]);

    const result = await requestBundle(deps(fakeFetch.fetch), "env-abc");

    expect(result.signedUrl).toMatch(/^https:\/\//);
    expect(fakeFetch.calls).toHaveLength(2);
  });

  it("gives up after 3 network failures", async () => {
    const fakeFetch = makeFakeFetch([
      { kind: "networkError", error: new TypeError("fetch failed") },
      { kind: "networkError", error: new TypeError("fetch failed") },
      { kind: "networkError", error: new TypeError("fetch failed") },
    ]);

    await expectRejects(
      requestBundle(deps(fakeFetch.fetch), "env-abc"),
      /Could not reach the QA Wolf API/i,
    );
    expect(fakeFetch.calls).toHaveLength(3);
  });

  it("does not retry on an HTTP error (4xx is deterministic)", async () => {
    const fakeFetch = makeFakeFetch([
      { kind: "bundleError", status: 404, body: "not found" },
      { kind: "ok", sourceArchive: "/dev/null" },
    ]);

    await expectRejects(
      requestBundle(deps(fakeFetch.fetch), "env-abc"),
      /could not find that environment|--env/i,
    );
    expect(fakeFetch.calls).toHaveLength(1);
  });
});
