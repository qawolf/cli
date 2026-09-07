import { describe, expect, it, mock } from "bun:test";

import { pollDeviceToken } from "./pollDeviceToken.js";
import { createFetchMock, jsonResponse, testDeps } from "./workos.testUtils.js";

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html" },
  });
}

describe("pollDeviceToken under transport faults", () => {
  it("reports an unreachable server as retryable, not as a refusal", async () => {
    const mockFetch = mock<typeof fetch>().mockRejectedValue(
      Error("socket hang up"),
    ) as unknown as typeof fetch;

    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: mockFetch,
    });

    if (result.kind !== "unreachable") throw Error("expected unreachable");
    expect(result.detail).toContain("socket hang up");
  });

  it("reports a success body that does not match the contract as an error", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(jsonResponse({ nonsense: true })),
    });

    if (result.kind !== "error") throw Error("expected an error response");
    expect(result.detail).toContain("unexpected response");
  });

  it.each([
    ["a bad gateway from a proxy", textResponse("<html>502</html>", 502)],
    [
      "a WorkOS 500",
      jsonResponse({ error: "internal_error" }, { status: 500 }),
    ],
    ["rate limiting", jsonResponse({ message: "slow down" }, { status: 429 })],
    [
      "a request timeout",
      jsonResponse({ message: "timeout" }, { status: 408 }),
    ],
    ["a captive portal answering 200", textResponse("<html>hi</html>", 200)],
  ])("retries rather than refusing on %s", async (_label, response) => {
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(response),
    });

    if (result.kind !== "unreachable") {
      throw Error(`expected unreachable, got ${result.kind}`);
    }
  });

  it("still refuses on a client error it cannot read", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(jsonResponse({ nope: true }, { status: 400 })),
    });

    if (result.kind !== "error") throw Error("expected an error response");
    expect(result.detail).toContain("HTTP 400");
  });

  // The device code is a credential. A redirect that forwarded it would hand
  // it to whichever host the response named.
  it("refuses a redirect rather than following it", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(
        new Response(undefined, {
          status: 302,
          headers: { location: "https://elsewhere.example/token" },
        }),
      ),
    });

    if (result.kind !== "error") throw Error("expected an error response");
    expect(result.detail).toContain("redirect");
  });
});
