import { describe, expect, it, mock } from "bun:test";

import { refreshAccessToken } from "./refreshAccessToken.js";
import {
  boundAccessToken,
  createFetchMock,
  jsonResponse,
  testDeps,
} from "./workos.testUtils.js";

const success = {
  access_token: boundAccessToken,
  refresh_token: "refresh_2",
  token_type: "Bearer",
  expires_in: 3600,
};

describe("refreshAccessToken", () => {
  // `resource` on every refresh: omitting it was observed to hand back a
  // token whose audience is the environment client id, which the API refuses.
  it("posts the refresh grant with the resource, as form fields", async () => {
    const mockFetch = createFetchMock(jsonResponse(success));

    await refreshAccessToken("refresh_1", { ...testDeps, fetch: mockFetch });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://signin.example/oauth2/token",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: "client_123",
          grant_type: "refresh_token",
          refresh_token: "refresh_1",
          resource: "https://app.example/api",
        }).toString(),
      }),
    );
  });

  it("returns the rotated refresh token, not the one it was given", async () => {
    const result = await refreshAccessToken("refresh_1", {
      ...testDeps,
      fetch: createFetchMock(jsonResponse(success)),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        accessToken: boundAccessToken,
        refreshToken: "refresh_2",
        expiresAt: 1_700_000_000_000,
        organizationId: "org_1",
      },
    });
  });

  it("refuses a response that rotates away the refresh token without a replacement", async () => {
    const { refresh_token: _refresh, ...withoutRefresh } = success;
    const result = await refreshAccessToken("refresh_1", {
      ...testDeps,
      fetch: createFetchMock(jsonResponse(withoutRefresh)),
    });

    if (result.ok) throw Error("expected failure, got success");
    expect(result.error).toContain("refresh token");
    expect(result.retryable).toBe(false);
  });

  it("fails when the refresh token has been revoked", async () => {
    const result = await refreshAccessToken("refresh_1", {
      ...testDeps,
      fetch: createFetchMock(
        jsonResponse(
          { error: "invalid_grant", error_description: "token revoked" },
          { status: 400 },
        ),
      ),
    });

    expect(result).toEqual({
      ok: false,
      error: "token revoked",
      retryable: false,
    });
  });

  // An unregistered resource is a deployment-configuration fault: no retry and
  // no sign-in changes it, and a fallback to the environment audience would
  // only produce a token the API refuses.
  it("names the resource when WorkOS rejects it as an invalid target", async () => {
    const result = await refreshAccessToken("refresh_1", {
      ...testDeps,
      fetch: createFetchMock(
        jsonResponse(
          {
            error: "invalid_target",
            error_description: "The requested resource is invalid",
          },
          { status: 400 },
        ),
      ),
    });

    if (result.ok) throw Error("expected failure, got success");
    expect(result.retryable).toBe(false);
    expect(result.error).toContain("https://app.example/api");
    expect(result.error).toContain("registered");
  });

  it("fails when the network is unreachable", async () => {
    const mockFetch = mock<typeof fetch>().mockRejectedValue(
      Error("socket hang up"),
    ) as unknown as typeof fetch;

    const result = await refreshAccessToken("refresh_1", {
      ...testDeps,
      fetch: mockFetch,
    });

    if (result.ok) throw Error("expected failure, got success");
    expect(result.error).toContain("socket hang up");
    // WorkOS asks clients to retry the same refresh token on a transport
    // failure, not to tear the session down.
    expect(result.retryable).toBe(true);
  });

  it.each([
    ["a WorkOS 500", 500],
    ["rate limiting", 429],
  ])(
    "marks %s retryable, so the session survives it",
    async (_label, status) => {
      const result = await refreshAccessToken("refresh_1", {
        ...testDeps,
        fetch: createFetchMock(jsonResponse({ error: "oops" }, { status })),
      });

      if (result.ok) throw Error("expected failure, got success");
      expect(result.retryable).toBe(true);
    },
  );

  it("marks a revoked grant terminal, so it is not retried", async () => {
    const result = await refreshAccessToken("refresh_1", {
      ...testDeps,
      fetch: createFetchMock(
        jsonResponse({ error: "invalid_grant" }, { status: 400 }),
      ),
    });

    if (result.ok) throw Error("expected failure, got success");
    expect(result.retryable).toBe(false);
  });

  it("refuses a redirect, which would forward the refresh token elsewhere", async () => {
    const result = await refreshAccessToken("refresh_1", {
      ...testDeps,
      fetch: createFetchMock(
        new Response(undefined, {
          status: 308,
          headers: { location: "https://elsewhere.example/token" },
        }),
      ),
    });

    if (result.ok) throw Error("expected failure, got success");
    expect(result.retryable).toBe(false);
    expect(result.error).toContain("redirect");
  });
});
