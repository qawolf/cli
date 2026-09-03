import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { deviceLogin } from "~/domains/auth/deviceLogin.js";
import { pollDeviceToken } from "./pollDeviceToken.js";
import { requestDeviceAuthorization } from "./requestDeviceAuthorization.js";

/**
 * Drives the client against a real HTTP server rather than a stubbed `fetch`.
 *
 * The unit tests assert what the client *sends*; these assert that a server
 * parsing those bytes the ordinary way gets the values back out. That catches
 * the mistakes a fetch mock cannot see — a body encoded one way while the
 * content type claims another, or parameters that never survive the round trip.
 */

function makeJwt(exp: number): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return [encode({ alg: "RS256" }), encode({ exp }), "sig"].join(".");
}

const accessToken = makeJwt(1_700_000_000);

/** Bodies as the server parsed them, so the test asserts on decoded values. */
const received: { authorize: unknown; token: Record<string, string>[] } = {
  authorize: undefined,
  token: [],
};

let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);

      if (url.pathname === "/user_management/authorize/device") {
        received.authorize = await request.json();
        return Response.json({
          device_code: "device_abc",
          user_code: "WDJB-MJHT",
          verification_uri: "https://example.com/device",
          verification_uri_complete: "https://example.com/device?u=WDJB-MJHT",
          expires_in: 300,
          interval: 1,
        });
      }

      if (url.pathname === "/user_management/authenticate") {
        const form = new URLSearchParams(await request.text());
        const fields = Object.fromEntries(form.entries());
        received.token.push(fields);

        // Stay pending once so the polling loop is exercised for real.
        if (received.token.length === 1) {
          return Response.json(
            { error: "authorization_pending" },
            {
              status: 400,
            },
          );
        }

        return Response.json({
          access_token: accessToken,
          refresh_token: "refresh_abc",
          user: { email: "person@example.com" },
          organization_id: "org_1",
        });
      }

      return new Response("not found", { status: 404 });
    },
  });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(async () => {
  await server.stop(true);
});

describe("WorkOS wire format", () => {
  it("completes a device flow against a server that parses the requests", async () => {
    const deps = { fetch: globalThis.fetch, baseUrl, clientId: "client_123" };
    const slept: number[] = [];

    const result = await deviceLogin({
      requestAuthorization: () => requestDeviceAuthorization(deps),
      pollToken: (deviceCode) => pollDeviceToken(deviceCode, deps),
      onPrompt: () => {},
      sleep: async (ms) => {
        slept.push(ms);
      },
      now: () => Date.now(),
      isCancelled: () => false,
    });

    expect(result).toEqual({
      ok: true,
      tokens: {
        accessToken,
        refreshToken: "refresh_abc",
        expiresAt: 1_700_000_000_000,
        email: "person@example.com",
        organizationId: "org_1",
      },
    });

    // The authorization body arrived as JSON the server could parse.
    expect(received.authorize).toEqual({ client_id: "client_123" });

    // Both token requests arrived as form fields the server could parse.
    expect(received.token).toEqual([
      {
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: "device_abc",
        client_id: "client_123",
      },
      {
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: "device_abc",
        client_id: "client_123",
      },
    ]);

    // It waited the interval the server advertised, not a hardcoded one.
    expect(slept).toEqual([1_000]);
  });
});
