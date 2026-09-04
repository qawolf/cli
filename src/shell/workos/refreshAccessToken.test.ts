import { describe, expect, it, mock } from "bun:test";

import { refreshAccessToken } from "./refreshAccessToken.js";

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

function makeJwt(exp: number): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return [encode({ alg: "RS256" }), encode({ exp }), "sig"].join(".");
}

const deps = {
  baseUrl: "https://api.example.com",
  clientId: "client_123",
};

describe("refreshAccessToken", () => {
  it("posts the refresh grant as form-encoded parameters", async () => {
    const mockFetch = createFetchMock(
      jsonResponse({
        access_token: makeJwt(1_700_000_000),
        refresh_token: "refresh_2",
        user: { email: "person@example.com" },
      }),
    );

    await refreshAccessToken("refresh_1", undefined, {
      ...deps,
      fetch: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/user_management/authenticate",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: "refresh_1",
          client_id: "client_123",
        }).toString(),
      }),
    );
  });

  it("pins the organization when one is given, so a refresh cannot silently move", async () => {
    const mockFetch = createFetchMock(
      jsonResponse({
        access_token: makeJwt(1_700_000_000),
        refresh_token: "refresh_2",
        user: { email: "person@example.com" },
        organization_id: "org_1",
      }),
    );

    await refreshAccessToken("refresh_1", "org_1", {
      ...deps,
      fetch: mockFetch,
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/user_management/authenticate",
      expect.objectContaining({
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: "refresh_1",
          client_id: "client_123",
          organization_id: "org_1",
        }).toString(),
      }),
    );
  });

  it("returns the rotated refresh token, not the one it was given", async () => {
    const accessToken = makeJwt(1_700_000_000);
    const result = await refreshAccessToken("refresh_1", undefined, {
      ...deps,
      fetch: createFetchMock(
        jsonResponse({
          access_token: accessToken,
          refresh_token: "refresh_2",
          user: { email: "person@example.com" },
          organization_id: "org_1",
        }),
      ),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        accessToken,
        refreshToken: "refresh_2",
        expiresAt: 1_700_000_000_000,
        email: "person@example.com",
        organizationId: "org_1",
      },
    });
  });

  it("fails when the refresh token has been revoked", async () => {
    const result = await refreshAccessToken("refresh_1", undefined, {
      ...deps,
      fetch: createFetchMock(
        jsonResponse(
          { error: "invalid_grant", error_description: "token revoked" },
          { status: 400 },
        ),
      ),
    });

    expect(result).toEqual({ ok: false, error: "token revoked" });
  });

  it("fails when the network is unreachable", async () => {
    const mockFetch = mock<typeof fetch>().mockRejectedValue(
      Error("socket hang up"),
    ) as unknown as typeof fetch;

    const result = await refreshAccessToken("refresh_1", undefined, {
      ...deps,
      fetch: mockFetch,
    });

    if (result.ok) throw Error("expected failure, got success");
    expect(result.error).toContain("socket hang up");
  });
});
