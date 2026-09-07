import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { discoverIssuer } from "~/shell/workos/discoverIssuer.js";
import { pollDeviceToken } from "~/shell/workos/pollDeviceToken.js";
import { refreshAccessToken } from "~/shell/workos/refreshAccessToken.js";
import { requestDeviceAuthorization } from "~/shell/workos/requestDeviceAuthorization.js";
import { makeJwt } from "./binding.testUtils.js";
import { deviceLogin } from "./deviceLogin.js";

/**
 * Drives the sign-in flow against a real HTTP server rather than a stubbed
 * `fetch`. It lives with the domain because it exercises `deviceLogin` end to
 * end; the shell clients it composes have their own unit tests.
 *
 * The unit tests assert what the client *sends*; these assert that a server
 * parsing those bytes the ordinary way gets the values back out, and that the
 * sequence as a whole reproduces what WorkOS was observed to do: the device grant answers
 * with a token for the environment client id, and only the refresh that
 * follows answers with one for the API resource.
 */

const clientId = "client_01CONNECT";
const environmentClientId = "client_01ENV";
let issuer = "";
let resource = "";

/** Bodies as the server parsed them, so the test asserts on decoded values. */
const received: {
  metadata: number;
  authorize: Record<string, string>[];
  deviceGrant: Record<string, string>[];
  refreshGrant: Record<string, string>[];
  identityBearer: string[];
} = {
  metadata: 0,
  authorize: [],
  deviceGrant: [],
  refreshGrant: [],
  identityBearer: [],
};

function environmentToken(): string {
  return makeJwt({ iss: issuer, aud: environmentClientId, exp: 1_700_000_000 });
}

function resourceToken(): string {
  return makeJwt({
    iss: issuer,
    aud: resource,
    exp: 1_700_000_100,
    org_id: "org_1",
  });
}

let server: ReturnType<typeof Bun.serve>;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);

      if (url.pathname === "/.well-known/oauth-authorization-server") {
        received.metadata += 1;
        return Response.json({
          issuer,
          device_authorization_endpoint: `${issuer}/oauth2/device_authorization`,
          token_endpoint: `${issuer}/oauth2/token`,
        });
      }

      if (url.pathname === "/oauth2/device_authorization") {
        const fields = Object.fromEntries(
          new URLSearchParams(await request.text()).entries(),
        );
        received.authorize.push(fields);
        return Response.json({
          device_code: "device_abc",
          user_code: "WDJB-MJHT",
          verification_uri: `${issuer}/device`,
          verification_uri_complete: `${issuer}/device?u=WDJB-MJHT`,
          expires_in: 300,
          interval: 1,
        });
      }

      if (url.pathname === "/oauth2/token") {
        const fields = Object.fromEntries(
          new URLSearchParams(await request.text()).entries(),
        );

        if (fields["grant_type"] === "refresh_token") {
          received.refreshGrant.push(fields);
          if (fields["refresh_token"] !== "refresh_from_device") {
            return Response.json({ error: "invalid_grant" }, { status: 400 });
          }
          return Response.json({
            access_token: resourceToken(),
            refresh_token: "refresh_rotated",
            token_type: "Bearer",
            expires_in: 3600,
          });
        }

        received.deviceGrant.push(fields);
        // Stay pending once so the polling loop is exercised for real.
        if (received.deviceGrant.length === 1) {
          return Response.json(
            { error: "authorization_pending" },
            { status: 400 },
          );
        }
        // As observed live: the device grant ignores `resource`.
        return Response.json({
          access_token: environmentToken(),
          refresh_token: "refresh_from_device",
          token_type: "Bearer",
          expires_in: 3600,
        });
      }

      if (url.pathname === "/api/v0/identity") {
        received.identityBearer.push(
          request.headers.get("authorization") ?? "",
        );
        return Response.json({
          user: { id: "user_1", email: "person@example.com" },
          organization: { id: "org_platform_1", name: "Acme" },
        });
      }

      return new Response("not found", { status: 404 });
    },
  });
  issuer = `http://localhost:${server.port}`;
  resource = `${issuer}/api`;
});

afterAll(async () => {
  await server.stop(true);
});

describe("WorkOS Connect wire format", () => {
  it("completes device login through the resource-bound refresh", async () => {
    const discovered = await discoverIssuer(issuer, globalThis.fetch);
    if (!discovered.ok) throw Error(discovered.error);

    const deps = {
      fetch: globalThis.fetch,
      clientId,
      resource,
      endpoints: discovered.value,
    };
    const slept: number[] = [];

    const result = await deviceLogin({
      requestAuthorization: () => requestDeviceAuthorization(deps),
      pollToken: (deviceCode) => pollDeviceToken(deviceCode, deps),
      refreshTokens: (refreshToken) => refreshAccessToken(refreshToken, deps),
      binding: { issuer, resource },
      fetchEmail: async (accessToken) => {
        const response = await fetch(`${issuer}/api/v0/identity`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const body = (await response.json()) as { user: { email: string } };
        return { ok: true, email: body.user.email };
      },
      onPrompt: () => {},
      sleep: async (ms) => {
        slept.push(ms);
      },
      now: () => Date.now(),
      isCancelled: () => false,
    });

    // The session is the second pair, never the first.
    expect(result).toEqual({
      ok: true,
      session: {
        accessToken: resourceToken(),
        refreshToken: "refresh_rotated",
        expiresAt: 1_700_000_100_000,
        organizationId: "org_1",
        email: "person@example.com",
      },
    });

    expect(received.metadata).toBe(1);

    expect(received.authorize).toEqual([
      {
        client_id: clientId,
        scope: "openid profile email offline_access",
        resource,
      },
    ]);

    expect(received.deviceGrant).toEqual([
      {
        client_id: clientId,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: "device_abc",
        resource,
      },
      {
        client_id: clientId,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: "device_abc",
        resource,
      },
    ]);

    expect(received.refreshGrant).toEqual([
      {
        client_id: clientId,
        grant_type: "refresh_token",
        refresh_token: "refresh_from_device",
        resource,
      },
    ]);

    // Identity was asked exactly once, and only with the resource-bound token.
    expect(received.identityBearer).toEqual([`Bearer ${resourceToken()}`]);

    // A public client: nothing that looks like a secret went over the wire.
    for (const fields of [
      ...received.authorize,
      ...received.deviceGrant,
      ...received.refreshGrant,
    ]) {
      expect(Object.keys(fields)).not.toContain("client_secret");
      expect(fields["client_id"]).toBe(clientId);
      expect(fields["resource"]).toBe(resource);
    }

    // It waited the interval the server advertised, not a hardcoded one.
    expect(slept).toEqual([1_000]);
  });
});
