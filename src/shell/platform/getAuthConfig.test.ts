import { describe, expect, it, mock } from "bun:test";

import { getAuthConfig } from "./getAuthConfig.js";

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

const baseUrl = "https://test.qawolf.com";

describe("getAuthConfig", () => {
  it("reads the deployment's sign-in configuration without credentials", async () => {
    const mockFetch = createFetchMock(
      jsonResponse({ workOsClientId: "client_1" }),
    );

    await getAuthConfig({ baseUrl, fetch: mockFetch });

    const [url, init] = (mockFetch as unknown as ReturnType<typeof mock>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe("https://test.qawolf.com/api/v0/auth/config");
    // No Authorization header: a client needs this before it has a token.
    expect(init.headers).toBeUndefined();
  });

  it("returns the client id the deployment publishes", async () => {
    const result = await getAuthConfig({
      baseUrl,
      fetch: createFetchMock(jsonResponse({ workOsClientId: "client_1" })),
    });

    expect(result).toBe("client_1");
  });

  it("reports nothing when the deployment does not serve the route", async () => {
    // Every deployment before this endpoint shipped, production included.
    const result = await getAuthConfig({
      baseUrl,
      fetch: createFetchMock(
        jsonResponse({ failureMessage: "Route not found" }, { status: 404 }),
      ),
    });

    expect(result).toBeUndefined();
  });

  it("reports nothing when the deployment publishes no client id", async () => {
    const result = await getAuthConfig({
      baseUrl,
      fetch: createFetchMock(
        jsonResponse({ failureMessage: "no client id" }, { status: 404 }),
      ),
    });

    expect(result).toBeUndefined();
  });

  it("reports nothing when the body does not match the contract", async () => {
    const result = await getAuthConfig({
      baseUrl,
      fetch: createFetchMock(jsonResponse({ nonsense: true })),
    });

    expect(result).toBeUndefined();
  });

  it("reports nothing when the deployment is unreachable", async () => {
    const mockFetch = mock<typeof fetch>().mockRejectedValue(
      Error("connect ECONNREFUSED"),
    ) as unknown as typeof fetch;

    const result = await getAuthConfig({ baseUrl, fetch: mockFetch });

    expect(result).toBeUndefined();
  });
});
