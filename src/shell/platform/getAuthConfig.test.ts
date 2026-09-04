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

    expect(result).toEqual({ kind: "configured", clientId: "client_1" });
  });

  it("reads a deployment that does not serve the route as offering none", async () => {
    // Every deployment before this endpoint shipped, production included.
    const result = await getAuthConfig({
      baseUrl,
      fetch: createFetchMock(
        jsonResponse({ failureMessage: "Route not found" }, { status: 404 }),
      ),
    });

    expect(result).toEqual({ kind: "unconfigured" });
  });

  // Distinct from the 404 above: the route answered, and published nothing.
  it("reads an answer carrying no client id as offering none", async () => {
    const result = await getAuthConfig({
      baseUrl,
      fetch: createFetchMock(jsonResponse({ workOsClientId: "" })),
    });

    expect(result).toEqual({ kind: "unconfigured" });
  });

  it("reads a body that does not match the contract as offering none", async () => {
    const result = await getAuthConfig({
      baseUrl,
      fetch: createFetchMock(jsonResponse({ nonsense: true })),
    });

    expect(result).toEqual({ kind: "unconfigured" });
  });

  // The three below must not read as "this deployment offers no browser
  // sign-in": nothing was learned about the deployment at all.
  it("separates an unreachable deployment from one that offers none", async () => {
    const mockFetch = mock<typeof fetch>().mockRejectedValue(
      Error("connect ECONNREFUSED"),
    ) as unknown as typeof fetch;

    const result = await getAuthConfig({ baseUrl, fetch: mockFetch });

    if (result.kind !== "unreachable") throw Error("expected unreachable");
    expect(result.detail).toContain("ECONNREFUSED");
  });

  it.each([
    ["a failing server", 503],
    ["rate limiting", 429],
    ["a request timeout", 408],
  ])("separates %s from a deployment that offers none", async (_l, status) => {
    const result = await getAuthConfig({
      baseUrl,
      fetch: createFetchMock(
        jsonResponse({ failureMessage: "boom" }, { status }),
      ),
    });

    expect(result).toEqual({
      kind: "unreachable",
      detail: `HTTP ${status}`,
    });
  });

  it("separates a body it could not read from one that offers none", async () => {
    const result = await getAuthConfig({
      baseUrl,
      fetch: createFetchMock(
        new Response("<html>hi</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      ),
    });

    expect(result.kind).toBe("unreachable");
  });
});
