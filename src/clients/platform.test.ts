import { afterEach, describe, expect, it, vi } from "vitest";

import { getIdentity } from "./platform.js";

function mockFetch(impl: (...args: unknown[]) => unknown): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    impl as unknown as typeof fetch,
  );
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("getIdentity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("sends the API key as a Bearer token to /api/v0/identity", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    const team = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "team_1",
      name: "Test Team",
    };
    mockFetch(() => Promise.resolve(jsonResponse({ team })));

    await getIdentity("qawolf_mykey");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://test.qawolf.com/api/v0/identity",
      expect.objectContaining({
        headers: { Authorization: "Bearer qawolf_mykey" },
      }),
    );
  });

  it("returns ok with parsed data on success", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    const team = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "team_1",
      name: "My Team",
    };
    mockFetch(() => Promise.resolve(jsonResponse({ team })));

    const result = await getIdentity("qawolf_key");
    expect(result).toEqual({ ok: true, data: { team } });
  });

  it("returns error with status on auth failure", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    mockFetch(() =>
      Promise.resolve(
        new Response('{"error":"You are not authenticated."}', {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const result = await getIdentity("qawolf_badkey");
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: '{"error":"You are not authenticated."}',
    });
  });

  it("returns error without status on network failure", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    mockFetch(() => Promise.reject(Error("fetch failed")));

    const result = await getIdentity("qawolf_key");
    expect(result).toEqual({
      ok: false,
      error: "fetch failed",
    });
  });

  it("returns error when response body does not match schema", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    mockFetch(() => Promise.resolve(jsonResponse({ unexpected: "shape" })));

    const result = await getIdentity("qawolf_key");
    expect(result).toEqual({
      ok: false,
      status: 200,
      error: "Unexpected response format",
    });
  });

  it("uses default API URL when QAWOLF_API_URL is not set", async () => {
    vi.stubEnv("QAWOLF_API_URL", "");
    const team = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "team_1",
      name: "Test",
    };
    mockFetch(() => Promise.resolve(jsonResponse({ team })));

    await getIdentity("qawolf_key");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://app.qawolf.com/api/v0/identity",
      expect.anything(),
    );
  });
});
