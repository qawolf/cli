import { describe, expect, it, mock } from "bun:test";

import { getIdentity } from "./getIdentity.js";

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

describe("getIdentity", () => {
  it("sends the API key as a Bearer token to /api/v0/identity", async () => {
    const team = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "team_1",
      name: "Test Team",
      slug: "acme",
    };
    const mockFetch = createFetchMock(jsonResponse({ team }));

    await getIdentity("qawolf_mykey", {
      fetch: mockFetch,
      baseUrl: "https://test.qawolf.com",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://test.qawolf.com/api/v0/identity",
      expect.objectContaining({
        headers: { Authorization: "Bearer qawolf_mykey" },
      }),
    );
  });

  it("returns ok with parsed data on success", async () => {
    const team = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "team_1",
      name: "My Team",
      slug: "acme",
    };
    const result = await getIdentity("qawolf_key", {
      fetch: createFetchMock(jsonResponse({ team })),
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({ ok: true, data: { team, organizations: [] } });
  });

  it("returns ok with parsed data for an organization identity", async () => {
    const organization = { id: "org_1", name: "Acme Org" };
    const result = await getIdentity("sk_orgkey", {
      fetch: createFetchMock(jsonResponse({ organization })),
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({
      ok: true,
      data: { organization, organizations: [] },
    });
  });

  it("returns http WireError with status on auth failure", async () => {
    const result = await getIdentity("qawolf_badkey", {
      fetch: createFetchMock(
        new Response('{"error":"You are not authenticated."}', {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "http",
        status: 401,
        body: '{"error":"You are not authenticated."}',
      },
    });
  });

  it("returns http WireError with raw body on non-JSON response", async () => {
    const result = await getIdentity("qawolf_key", {
      fetch: createFetchMock(
        new Response("<html>Bad Gateway</html>", {
          status: 502,
          statusText: "Bad Gateway",
          headers: { "content-type": "text/html" },
        }),
      ),
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({
      ok: false,
      error: { kind: "http", status: 502, body: "<html>Bad Gateway</html>" },
    });
  });

  it("returns network WireError on fetch failure", async () => {
    const cause = new Error("fetch failed");
    const mockFetch = mock<typeof fetch>().mockRejectedValue(
      cause,
    ) as unknown as typeof fetch;

    const result = await getIdentity("qawolf_key", {
      fetch: mockFetch,
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({ ok: false, error: { kind: "network", cause } });
  });

  it("returns parse WireError when response body does not match schema", async () => {
    const result = await getIdentity("qawolf_key", {
      fetch: createFetchMock(jsonResponse({ unexpected: "shape" })),
      baseUrl: "https://test.qawolf.com",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("parse");
  });

  it("uses deps.baseUrl in the request URL", async () => {
    const team = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "team_1",
      name: "Test Team",
      slug: "acme",
    };
    const mockFetch = createFetchMock(jsonResponse({ team }));

    await getIdentity("qawolf_key", {
      fetch: mockFetch,
      baseUrl: "https://app.qawolf.com",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://app.qawolf.com/api/v0/identity",
      expect.anything(),
    );
  });

  it("returns ok with slug undefined when team slug is absent (pre-platform-update)", async () => {
    const team = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "t1",
      name: "Test Team",
    };
    const result = await getIdentity("qawolf_key", {
      fetch: createFetchMock(jsonResponse({ team })),
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({ ok: true, data: { team, organizations: [] } });
  });
});
