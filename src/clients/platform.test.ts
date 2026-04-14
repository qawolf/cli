import superjson from "superjson";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getIdentity } from "./platform.js";

// tRPC wraps successful responses with superjson serialization
function trpcSuccessResponse(data: unknown): unknown {
  return {
    result: { data: superjson.serialize(data) },
  };
}

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

function mockFetch(impl: (...args: unknown[]) => unknown): void {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    impl as unknown as typeof fetch,
  );
}

describe("getIdentity", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("sends the API key as a Bearer token to the tRPC endpoint", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    const teamData = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "team_1",
      name: "Test Team",
    };
    mockFetch(() =>
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
  });

  it("returns ok with parsed data on success", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    const teamData = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "team_1",
      name: "My Team",
    };
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(trpcSuccessResponse({ team: teamData })),
      }),
    );

    const result = await getIdentity("qawolf_key");
    expect(result).toEqual({ ok: true, data: { team: teamData } });
  });

  it("returns error on auth failure", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    mockFetch(() =>
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
  });

  it("returns error on network failure", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    mockFetch(() => Promise.reject(new Error("fetch failed")));

    const result = await getIdentity("qawolf_key");
    expect(result).toEqual({
      ok: false,
      error: "fetch failed",
    });
  });

  it("returns error when response body does not match schema", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    mockFetch(() =>
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
  });

  it("uses default API URL when QAWOLF_API_URL is not set", async () => {
    vi.stubEnv("QAWOLF_API_URL", "");
    const teamData = {
      createdAt: "2024-01-01T00:00:00.000Z",
      id: "team_1",
      name: "Test",
    };
    mockFetch(() =>
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
  });
});
