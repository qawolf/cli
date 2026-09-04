import { describe, expect, it, mock } from "bun:test";

import { pollDeviceToken } from "./pollDeviceToken.js";

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

const accessToken = makeJwt(1_700_000_000);

const success = {
  access_token: accessToken,
  refresh_token: "refresh_abc",
  user: { email: "person@example.com" },
  organization_id: "org_1",
};

const deps = {
  baseUrl: "https://api.example.com",
  clientId: "client_123",
};

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html" },
  });
}

function errorResponse(error: string, description?: string): Response {
  return jsonResponse(
    description ? { error, error_description: description } : { error },
    { status: 400 },
  );
}

describe("pollDeviceToken", () => {
  it("posts the device code grant as form-encoded parameters", async () => {
    const mockFetch = createFetchMock(jsonResponse(success));

    await pollDeviceToken("device_abc", { ...deps, fetch: mockFetch });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/user_management/authenticate",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: "device_abc",
          client_id: "client_123",
        }).toString(),
      }),
    );
  });

  it("returns tokens with the expiry read from the access token", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...deps,
      fetch: createFetchMock(jsonResponse(success)),
    });

    expect(result).toEqual({
      kind: "tokens",
      tokens: {
        accessToken,
        refreshToken: "refresh_abc",
        expiresAt: 1_700_000_000_000,
        email: "person@example.com",
        organizationId: "org_1",
      },
    });
  });

  it("keeps the organization undefined when the server names none", async () => {
    const { organization_id: _org, ...withoutOrg } = success;
    const result = await pollDeviceToken("device_abc", {
      ...deps,
      fetch: createFetchMock(jsonResponse(withoutOrg)),
    });

    if (result.kind !== "tokens") throw Error("expected tokens");
    expect(result.tokens.organizationId).toBeUndefined();
  });

  it("reads WorkOS authentication errors, which carry a code rather than an error", async () => {
    // These are shaped unlike the OAuth errors: `code` and `message`, plus a
    // pending token and the organizations to choose between.
    const result = await pollDeviceToken("device_abc", {
      ...deps,
      fetch: createFetchMock(
        jsonResponse(
          {
            code: "organization_selection_required",
            message: "Choose an organization to continue.",
            pending_authentication_token: "pat_123",
            organizations: [{ id: "org_1", name: "Acme" }],
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
      ...deps,
      fetch: createFetchMock(errorResponse("authorization_pending")),
    });

    expect(result).toEqual({ kind: "pending" });
  });

  it("reports slow_down as slow-down", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...deps,
      fetch: createFetchMock(errorResponse("slow_down")),
    });

    expect(result).toEqual({ kind: "slow-down" });
  });

  it("reports access_denied as denied", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...deps,
      fetch: createFetchMock(errorResponse("access_denied")),
    });

    expect(result).toEqual({ kind: "denied" });
  });

  it("reports expired_token as expired", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...deps,
      fetch: createFetchMock(errorResponse("expired_token")),
    });

    expect(result).toEqual({ kind: "expired" });
  });

  it("treats invalid_grant as expiry, which is what WorkOS sends for a lapsed code", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...deps,
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
      ...deps,
      fetch: createFetchMock(errorResponse("invalid_client", "unknown client")),
    });

    expect(result).toEqual({ kind: "error", detail: "unknown client" });
  });

  it("reports an unreachable server as retryable, not as a refusal", async () => {
    const mockFetch = mock<typeof fetch>().mockRejectedValue(
      Error("socket hang up"),
    ) as unknown as typeof fetch;

    const result = await pollDeviceToken("device_abc", {
      ...deps,
      fetch: mockFetch,
    });

    if (result.kind !== "unreachable") throw Error("expected unreachable");
    expect(result.detail).toContain("socket hang up");
  });

  it("reports a success body that does not match the contract as an error", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...deps,
      fetch: createFetchMock(jsonResponse({ access_token: "only-this" })),
    });

    if (result.kind !== "error") throw Error("expected an error response");
    expect(result.detail).toContain("unexpected response");
  });
  // A device flow runs for minutes and the person has often already approved in
  // the browser, so a fault the server may recover from has to be retried
  // rather than ending the flow.
  it.each([
    ["a bad gateway from a proxy", textResponse("<html>502</html>", 502)],
    [
      "a WorkOS 500",
      jsonResponse({ error: "internal_error" }, { status: 500 }),
    ],
    ["rate limiting", jsonResponse({ message: "slow down" }, { status: 429 })],
    ["a captive portal answering 200", textResponse("<html>hi</html>", 200)],
  ])("retries rather than refusing on %s", async (_label, response) => {
    const result = await pollDeviceToken("device_abc", {
      ...deps,
      fetch: createFetchMock(response),
    });

    if (result.kind !== "unreachable") {
      throw Error(`expected unreachable, got ${result.kind}`);
    }
  });

  it("still refuses on a client error it cannot read", async () => {
    const result = await pollDeviceToken("device_abc", {
      ...deps,
      fetch: createFetchMock(jsonResponse({ nope: true }, { status: 400 })),
    });

    if (result.kind !== "error") throw Error("expected an error response");
    expect(result.detail).toContain("HTTP 400");
  });
});
