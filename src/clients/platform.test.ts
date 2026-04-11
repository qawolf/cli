import superjson from "superjson";
import { describe, expect, it, vi } from "vitest";

import { getIdentity } from "./platform.js";

function mockFetch(impl: (...args: unknown[]) => unknown): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

// tRPC wraps successful responses with superjson serialization
function trpcSuccessResponse(data: unknown): unknown {
  return {
    result: { data: superjson.serialize(data) },
  };
}

// tRPC error responses
function trpcErrorResponse(
  message: string,
  code: number,
  httpStatus: number,
): unknown {
  return {
    error: {
      message,
      code,
      data: { code: "UNAUTHORIZED", httpStatus },
    },
  };
}

describe("getIdentity", () => {
  it("sends the API key as a Bearer token to the tRPC endpoint", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    const teamData = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "team_1",
      name: "Test Team",
    };
    const restore = mockFetch(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(trpcSuccessResponse({ team: teamData })),
      }),
    );

    await getIdentity("qawolf_mykey");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://test.qawolf.com/api/trpc/identity.get"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer qawolf_mykey",
        }),
      }),
    );

    restore();
    vi.unstubAllEnvs();
  });

  it("returns ok with parsed data on success", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    const teamData = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "team_1",
      name: "My Team",
    };
    const restore = mockFetch(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(trpcSuccessResponse({ team: teamData })),
      }),
    );

    const result = await getIdentity("qawolf_key");
    expect(result).toEqual({ ok: true, data: { team: teamData } });

    restore();
    vi.unstubAllEnvs();
  });

  it("returns error on auth failure", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    const restore = mockFetch(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: () =>
          Promise.resolve(
            trpcErrorResponse(
              "Invalid API token in Authorization header",
              -32001,
              401,
            ),
          ),
      }),
    );

    const result = await getIdentity("qawolf_badkey");
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Invalid API token in Authorization header",
    });

    restore();
    vi.unstubAllEnvs();
  });

  it("returns error on network failure", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    const restore = mockFetch(() => Promise.reject(new Error("fetch failed")));

    const result = await getIdentity("qawolf_key");
    expect(result).toEqual({
      ok: false,
      status: 0,
      error: "fetch failed",
    });

    restore();
    vi.unstubAllEnvs();
  });

  it("returns error when response body does not match schema", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    const restore = mockFetch(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () =>
          Promise.resolve(trpcSuccessResponse({ unexpected: "shape" })),
      }),
    );

    const result = await getIdentity("qawolf_key");
    expect(result).toEqual({
      ok: false,
      status: 200,
      error: "Unexpected response format",
    });

    restore();
    vi.unstubAllEnvs();
  });

  it("uses default API URL when QAWOLF_API_URL is not set", async () => {
    delete process.env["QAWOLF_API_URL"];
    const teamData = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "team_1",
      name: "Test",
    };
    const restore = mockFetch(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(trpcSuccessResponse({ team: teamData })),
      }),
    );

    await getIdentity("qawolf_key");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("https://app.qawolf.com/api/trpc/identity.get"),
      expect.anything(),
    );

    restore();
  });
});
