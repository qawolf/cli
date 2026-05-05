import { describe, expect, it, mock } from "bun:test";

import { getIdentity } from "./platform.js";

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
    };
    const mockFetch = mock<typeof fetch>().mockResolvedValue(
      jsonResponse({ team }),
    );

    await getIdentity("qawolf_mykey", {
      fetch: mockFetch as unknown as typeof fetch,
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
    };
    const mockFetch = mock<typeof fetch>().mockResolvedValue(
      jsonResponse({ team }),
    );

    const result = await getIdentity("qawolf_key", {
      fetch: mockFetch as unknown as typeof fetch,
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({ ok: true, data: { team } });
  });

  it("extracts `error` from JSON body on auth failure", async () => {
    const mockFetch = mock<typeof fetch>().mockResolvedValue(
      new Response('{"error":"You are not authenticated."}', {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await getIdentity("qawolf_badkey", {
      fetch: mockFetch as unknown as typeof fetch,
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "You are not authenticated.",
    });
  });

  it("falls back to statusText when body is not JSON", async () => {
    const mockFetch = mock<typeof fetch>().mockResolvedValue(
      new Response("<html>Bad Gateway</html>", {
        status: 502,
        statusText: "Bad Gateway",
        headers: { "content-type": "text/html" },
      }),
    );

    const result = await getIdentity("qawolf_key", {
      fetch: mockFetch as unknown as typeof fetch,
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({
      ok: false,
      status: 502,
      error: "Bad Gateway",
    });
  });

  it("returns error without status on network failure", async () => {
    const mockFetch = mock<typeof fetch>().mockRejectedValue(
      Error("fetch failed"),
    );

    const result = await getIdentity("qawolf_key", {
      fetch: mockFetch as unknown as typeof fetch,
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({
      ok: false,
      error: "fetch failed",
    });
  });

  it("returns error when response body does not match schema", async () => {
    const mockFetch = mock<typeof fetch>().mockResolvedValue(
      jsonResponse({ unexpected: "shape" }),
    );

    const result = await getIdentity("qawolf_key", {
      fetch: mockFetch as unknown as typeof fetch,
      baseUrl: "https://test.qawolf.com",
    });

    expect(result).toEqual({
      ok: false,
      status: 200,
      error: "Unexpected response format",
    });
  });

  it("uses deps.baseUrl in the request URL", async () => {
    const team = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "team_1",
      name: "Test Team",
    };
    const mockFetch = mock<typeof fetch>().mockResolvedValue(
      jsonResponse({ team }),
    );

    await getIdentity("qawolf_key", {
      fetch: mockFetch as unknown as typeof fetch,
      baseUrl: "https://app.qawolf.com",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://app.qawolf.com/api/v0/identity",
      expect.anything(),
    );
  });
});
