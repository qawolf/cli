import { describe, expect, it, mock } from "bun:test";

import { requestDeviceAuthorization } from "./requestDeviceAuthorization.js";

function createFetchMock(resolvedValue: Response) {
  return mock<typeof fetch>().mockResolvedValue(
    resolvedValue,
  ) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const authorization = {
  device_code: "device_abc",
  user_code: "WDJB-MJHT",
  verification_uri: "https://example.com/device",
  verification_uri_complete: "https://example.com/device?user_code=WDJB-MJHT",
  expires_in: 300,
  interval: 5,
};

const deps = {
  baseUrl: "https://api.example.com",
  clientId: "client_123",
};

type Result = Awaited<ReturnType<typeof requestDeviceAuthorization>>;

function expectOk(result: Result) {
  if (!result.ok) throw Error(`expected success, got: ${result.error}`);
  return result.value;
}

function expectError(result: Result): string {
  if (result.ok) throw Error("expected failure, got success");
  return result.error;
}

describe("requestDeviceAuthorization", () => {
  it("posts the client id as JSON to the device authorization endpoint", async () => {
    const mockFetch = createFetchMock(jsonResponse(authorization));

    await requestDeviceAuthorization({ ...deps, fetch: mockFetch });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/user_management/authorize/device",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: "client_123" }),
      }),
    );
  });

  it("returns the authorization in the shape the poller expects", async () => {
    const result = await requestDeviceAuthorization({
      ...deps,
      fetch: createFetchMock(jsonResponse(authorization)),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        deviceCode: "device_abc",
        userCode: "WDJB-MJHT",
        verificationUri: "https://example.com/device",
        verificationUriComplete:
          "https://example.com/device?user_code=WDJB-MJHT",
        expiresInSec: 300,
        intervalSec: 5,
      },
    });
  });

  it("falls back to a five second interval when the server omits one", async () => {
    const { interval: _interval, ...withoutInterval } = authorization;
    const result = await requestDeviceAuthorization({
      ...deps,
      fetch: createFetchMock(jsonResponse(withoutInterval)),
    });

    expect(expectOk(result).intervalSec).toBe(5);
  });

  it("reports a missing complete URI as undefined rather than omitting it", async () => {
    const { verification_uri_complete: _complete, ...partial } = authorization;
    const result = await requestDeviceAuthorization({
      ...deps,
      fetch: createFetchMock(jsonResponse(partial)),
    });

    expect(expectOk(result).verificationUriComplete).toBeUndefined();
  });

  it("fails when the device grant is not enabled for the client", async () => {
    const result = await requestDeviceAuthorization({
      ...deps,
      fetch: createFetchMock(
        jsonResponse(
          { error: "unauthorized_client", error_description: "not enabled" },
          { status: 400 },
        ),
      ),
    });

    expect(result).toEqual({
      ok: false,
      error: "not enabled",
      retryable: false,
    });
  });

  it("fails with the error code when no description is given", async () => {
    const result = await requestDeviceAuthorization({
      ...deps,
      fetch: createFetchMock(
        jsonResponse({ error: "invalid_client" }, { status: 400 }),
      ),
    });

    expect(result).toEqual({
      ok: false,
      error: "invalid_client",
      retryable: false,
    });
  });

  it("fails when the response body does not match the contract", async () => {
    const result = await requestDeviceAuthorization({
      ...deps,
      fetch: createFetchMock(jsonResponse({ nonsense: true })),
    });

    expect(expectError(result)).toContain("unexpected response");
  });

  it("fails when the network is unreachable", async () => {
    const mockFetch = mock<typeof fetch>().mockRejectedValue(
      Error("connect ECONNREFUSED"),
    ) as unknown as typeof fetch;

    const result = await requestDeviceAuthorization({
      ...deps,
      fetch: mockFetch,
    });

    expect(expectError(result)).toContain("connect ECONNREFUSED");
  });
});
