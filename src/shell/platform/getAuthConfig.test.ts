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

/** What a Connect-enabled deployment publishes. The two ids are distinct. */
const connect = {
  workOsClientId: "client_01ENV",
  authorizationServer: "https://signin.example",
  workOsConnectClientId: "client_01CONNECT",
};

describe("getAuthConfig", () => {
  it("reads the deployment's sign-in configuration without credentials", async () => {
    const mockFetch = createFetchMock(jsonResponse(connect));

    await getAuthConfig({ baseUrl, fetch: mockFetch });

    const [url, init] = (mockFetch as unknown as ReturnType<typeof mock>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe("https://test.qawolf.com/api/v0/auth/config");
    // No Authorization header: a client needs this before it has a token.
    expect(init.headers).toBeUndefined();
  });

  // The environment client id is what the legacy flow signed in with. Tokens
  // it issues carry that id as their audience, which the API rejects.
  it("selects the Connect client id and issuer, not the environment id", async () => {
    const result = await getAuthConfig({
      baseUrl,
      fetch: createFetchMock(jsonResponse(connect)),
    });

    expect(result).toEqual({
      kind: "configured",
      issuer: "https://signin.example",
      clientId: "client_01CONNECT",
    });
  });

  it("reads a deployment publishing only the environment id as legacy-only", async () => {
    const result = await getAuthConfig({
      baseUrl,
      fetch: createFetchMock(jsonResponse({ workOsClientId: "client_01ENV" })),
    });

    expect(result).toEqual({ kind: "legacy-only" });
  });

  // Half a Connect configuration is a deployment mistake, and substituting the
  // environment id would sign someone in to a token the API then refuses.
  it.each([
    ["the issuer", "authorizationServer"],
    ["the Connect client id", "workOsConnectClientId"],
  ])("reads a configuration missing %s as misconfigured", async (_l, field) => {
    const { [field]: _dropped, ...partial } = connect as Record<string, string>;

    const result = await getAuthConfig({
      baseUrl,
      fetch: createFetchMock(jsonResponse(partial)),
    });

    if (result.kind !== "misconfigured") {
      throw Error(`expected misconfigured, got ${result.kind}`);
    }
    expect(result.detail).toContain(field);
  });

  it("treats a blank Connect field as absent", async () => {
    const result = await getAuthConfig({
      baseUrl,
      fetch: createFetchMock(
        jsonResponse({ ...connect, workOsConnectClientId: "  " }),
      ),
    });

    expect(result.kind).toBe("misconfigured");
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
