import { describe, expect, it, vi } from "vitest";

import { getIdentity } from "./platform.js";

function mockFetch(impl: (...args: unknown[]) => unknown): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

describe("getIdentity", () => {
  it("sends the API key as a Bearer token", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    const restore = mockFetch(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            team: {
              createdAt: "2024-01-01T00:00:00.000Z",
              id: "team_1",
              name: "Test Team",
            },
          }),
      }),
    );

    await getIdentity("qawolf_mykey");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://test.qawolf.com/api/v0/identity",
      expect.objectContaining({
        headers: { Authorization: "Bearer qawolf_mykey" },
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
        json: () => Promise.resolve({ team: teamData }),
      }),
    );

    const result = await getIdentity("qawolf_key");
    expect(result).toEqual({ ok: true, data: { team: teamData } });

    restore();
    vi.unstubAllEnvs();
  });

  it("returns error on non-ok response", async () => {
    vi.stubEnv("QAWOLF_API_URL", "https://test.qawolf.com");
    const restore = mockFetch(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("Invalid API token"),
      }),
    );

    const result = await getIdentity("qawolf_badkey");
    expect(result).toEqual({
      ok: false,
      status: 401,
      error: "Invalid API token",
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
        status: 200,
        json: () => Promise.resolve({ unexpected: "shape" }),
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
    const restore = mockFetch(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            team: {
              createdAt: "2024-01-01T00:00:00.000Z",
              id: "team_1",
              name: "Test",
            },
          }),
      }),
    );

    await getIdentity("qawolf_key");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://app.qawolf.com/api/v0/identity",
      expect.anything(),
    );

    restore();
  });
});
