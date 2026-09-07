import { describe, expect, it } from "bun:test";

import { pollDeviceToken } from "./pollDeviceToken.js";
import {
  boundAccessToken,
  createFetchMock,
  jsonResponse,
  makeJwt,
  testDeps,
} from "./workos.testUtils.js";

/**
 * Connect-shaped: a plain OAuth token response. No `user`, no top-level
 * `organization_id` — those were the legacy WorkOS User Management shape.
 */
const success = {
  access_token: boundAccessToken,
  refresh_token: "refresh_abc",
  token_type: "Bearer",
  expires_in: 3600,
  scope: "openid profile email offline_access",
};

function errorResponse(error: string, description?: string): Response {
  return jsonResponse(
    description ? { error, error_description: description } : { error },
    { status: 400 },
  );
}

describe("pollDeviceToken", () => {
  it("posts the device code grant as form fields to the discovered token endpoint", async () => {
    const mockFetch = createFetchMock(jsonResponse(success));

    await pollDeviceToken("device_abc", { ...testDeps, fetch: mockFetch });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://signin.example/oauth2/token",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: "client_123",
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: "device_abc",
          resource: "https://app.example/api",
        }).toString(),
      }),
    );
  });

  it("returns tokens with the expiry and organization read from the access token", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(jsonResponse(success)),
    });

    expect(result).toEqual({
      kind: "tokens",
      tokens: {
        accessToken: boundAccessToken,
        refreshToken: "refresh_abc",
        expiresAt: 1_700_000_000_000,
        organizationId: "org_1",
      },
    });
  });

  it("keeps the organization undefined when the token names none", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(
        jsonResponse({ ...success, access_token: makeJwt({ exp: 1 }) }),
      ),
    });

    if (result.kind !== "tokens") throw Error("expected tokens");
    expect(result.tokens.organizationId).toBeUndefined();
  });

  // Without a refresh token there is no way to obtain the resource-bound
  // token the API accepts, so the grant is unusable however it looks.
  it("refuses a token response that carries no refresh token", async () => {
    const { refresh_token: _refresh, ...withoutRefresh } = success;
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(jsonResponse(withoutRefresh)),
    });

    if (result.kind !== "error") throw Error("expected an error response");
    expect(result.detail).toContain("refresh token");
  });

  it("reads WorkOS authentication errors, which carry a code rather than an error", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(
        jsonResponse(
          {
            code: "organization_selection_required",
            message: "Choose an organization to continue.",
          },
          { status: 400 },
        ),
      ),
    });

    expect(result).toEqual({
      kind: "error",
      detail: "Choose an organization to continue.",
    });
  });

  it("reports authorization_pending as pending", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(errorResponse("authorization_pending")),
    });

    expect(result).toEqual({ kind: "pending" });
  });

  it("reports slow_down as slow-down", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(errorResponse("slow_down")),
    });

    expect(result).toEqual({ kind: "slow-down" });
  });

  it("reports access_denied as denied", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(errorResponse("access_denied")),
    });

    expect(result).toEqual({ kind: "denied" });
  });

  it("reports expired_token as expired", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(errorResponse("expired_token")),
    });

    expect(result).toEqual({ kind: "expired" });
  });

  it("treats invalid_grant as expiry, which is what WorkOS sends for a lapsed code", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(
        errorResponse(
          "invalid_grant",
          "The device code provided is invalid, expired, or has already been used.",
        ),
      ),
    });

    expect(result).toEqual({ kind: "expired" });
  });

  it("reports an unrecognised error code with its description", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...testDeps,
      fetch: createFetchMock(errorResponse("invalid_client", "unknown client")),
    });

    expect(result).toEqual({ kind: "error", detail: "unknown client" });
  });
});
