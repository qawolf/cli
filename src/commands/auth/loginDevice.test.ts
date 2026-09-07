import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { Entry } from "@napi-rs/keyring";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import type { CommandContext } from "~/shell/commandContext.js";
import type { UI } from "~/shell/ui/types.js";
import { loginWithDevice } from "./loginDevice.js";

afterEach(() => {
  mock.restore();
});

const apiBaseUrl = "https://app.example";
const issuer = "https://signin.example";
const resource = "https://app.example/api";

function makeJwt(payload: unknown): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return [encode({ alg: "RS256" }), encode(payload), "sig"].join(".");
}

const environmentToken = makeJwt({ iss: issuer, aud: "client_01ENV", exp: 2 });
const boundToken = makeJwt({ iss: issuer, aud: resource, exp: 2, org_id: "o" });

type Route = (request: Request) => Response | Promise<Response>;

/**
 * The whole conversation, as the servers involved would hold it: deployment
 * config, issuer metadata, the three grants, and identity.
 */
function makeServers(overrides: Partial<Record<string, Route>> = {}) {
  const bearer: string[] = [];
  const routes: Record<string, Route> = {
    [`${apiBaseUrl}/api/v0/auth/config`]: () =>
      Response.json({
        workOsClientId: "client_01ENV",
        authorizationServer: issuer,
        workOsConnectClientId: "client_01CONNECT",
      }),
    [`${issuer}/.well-known/oauth-authorization-server`]: () =>
      Response.json({
        issuer,
        device_authorization_endpoint: `${issuer}/oauth2/device_authorization`,
        token_endpoint: `${issuer}/oauth2/token`,
      }),
    [`${issuer}/oauth2/device_authorization`]: () =>
      Response.json({
        device_code: "device_abc",
        user_code: "WDJB-MJHT",
        verification_uri: `${issuer}/device`,
        expires_in: 300,
        interval: 1,
      }),
    [`${issuer}/oauth2/token`]: async (request) => {
      const form = new URLSearchParams(await request.text());
      if (form.get("grant_type") === "refresh_token") {
        return Response.json({
          access_token: boundToken,
          refresh_token: "refresh_rotated",
        });
      }
      return Response.json({
        access_token: environmentToken,
        refresh_token: "refresh_from_device",
      });
    },
    [`${apiBaseUrl}/api/v0/identity`]: (request) => {
      bearer.push(request.headers.get("authorization") ?? "");
      return Response.json({
        user: { id: "user_1", email: "person@example.com" },
        organization: { id: "org_qw_1", name: "Acme" },
        organizations: [],
      });
    },
    ...overrides,
  };
  const fetchFn = (async (input: string, init?: RequestInit) => {
    const url = input;
    const route = routes[url];
    if (!route) return new Response("not found", { status: 404 });
    return route(new Request(url, init));
  }) as unknown as typeof fetch;
  return { fetchFn, bearer };
}

function makeCtx() {
  const fs = makeMemoryFs();
  const ui = {
    note: mock(),
    info: mock(),
    step: mock(),
    outro: mock(),
  } as unknown as UI;
  const ctx = {
    ui,
    configDir: "/config",
    apiBaseUrl,
    fs,
    signals: { register: () => () => {} },
    log: () => ({ debug: () => {} }),
  } as unknown as CommandContext;
  return { ctx, ui, fs };
}

describe("loginWithDevice", () => {
  it("signs in through the resource-bound refresh and stores that session", async () => {
    spyOn(Entry.prototype, "setPassword").mockImplementation(() => {
      throw Error("keychain unavailable");
    });
    const { ctx, ui, fs } = makeCtx();
    const { fetchFn, bearer } = makeServers();
    const opened: string[] = [];

    const result = await loginWithDevice(ctx, {
      fetch: fetchFn,
      platform: "darwin",
      openBrowser: async (url) => {
        opened.push(url);
        return true;
      },
    });

    expect(result).toBeUndefined();
    expect(opened).toEqual([`${issuer}/device`]);
    // Identity saw the bound token only; the first one never left the CLI.
    expect(bearer).toEqual([`Bearer ${boundToken}`]);
    expect(ui.outro).toHaveBeenCalledWith("Signed in as person@example.com.");

    const stored: unknown = JSON.parse(
      await fs.readFile("/config/tokens.json"),
    );
    expect(stored).toEqual({
      accessToken: boundToken,
      refreshToken: "refresh_rotated",
      expiresAt: 2_000,
      organizationId: "o",
      email: "person@example.com",
      issuer,
      clientId: "client_01CONNECT",
      resource,
    });
  });

  it("does not report success when the refresh still yields the environment audience", async () => {
    const setPassword = spyOn(Entry.prototype, "setPassword").mockReturnValue(
      undefined,
    );
    const { ctx, ui } = makeCtx();
    const { fetchFn, bearer } = makeServers({
      [`${issuer}/oauth2/token`]: () =>
        Response.json({
          access_token: environmentToken,
          refresh_token: "refresh_any",
        }),
    });

    const result = await loginWithDevice(ctx, {
      fetch: fetchFn,
      platform: "darwin",
      openBrowser: async () => true,
    });

    if (!result) throw Error("expected a failure");
    expect(result.error).toContain("would not accept");
    expect(bearer).toEqual([]);
    expect(setPassword).not.toHaveBeenCalled();
    expect(ui.outro).not.toHaveBeenCalled();
  });

  it("does not report success when the API rejects the bound token", async () => {
    const setPassword = spyOn(Entry.prototype, "setPassword").mockReturnValue(
      undefined,
    );
    const { ctx } = makeCtx();
    const { fetchFn } = makeServers({
      [`${apiBaseUrl}/api/v0/identity`]: () =>
        Response.json({ failureMessage: "nope" }, { status: 401 }),
    });

    const result = await loginWithDevice(ctx, {
      fetch: fetchFn,
      platform: "darwin",
      openBrowser: async () => true,
    });

    if (!result) throw Error("expected a failure");
    expect(result.error).toContain("did not accept");
    expect(setPassword).not.toHaveBeenCalled();
  });

  it("tells a legacy-only deployment apart from one offering nothing", async () => {
    const { ctx } = makeCtx();
    const { fetchFn } = makeServers({
      [`${apiBaseUrl}/api/v0/auth/config`]: () =>
        Response.json({ workOsClientId: "client_01ENV" }),
    });

    const result = await loginWithDevice(ctx, {
      fetch: fetchFn,
      platform: "darwin",
      openBrowser: async () => true,
    });

    if (!result) throw Error("expected a failure");
    expect(result.error).toContain("WorkOS Connect");
  });

  it("reports an unregistered resource as a deployment fault, not a retry", async () => {
    const { ctx } = makeCtx();
    const tokenCalls: string[] = [];
    const { fetchFn } = makeServers({
      [`${issuer}/oauth2/token`]: async (request) => {
        const form = new URLSearchParams(await request.text());
        tokenCalls.push(form.get("grant_type") ?? "");
        if (form.get("grant_type") === "refresh_token") {
          return Response.json({ error: "invalid_target" }, { status: 400 });
        }
        return Response.json({
          access_token: environmentToken,
          refresh_token: "refresh_from_device",
        });
      },
    });

    const result = await loginWithDevice(ctx, {
      fetch: fetchFn,
      platform: "darwin",
      openBrowser: async () => true,
    });

    if (!result) throw Error("expected a failure");
    expect(result.errorBody).toContain(resource);
    expect(tokenCalls.filter((g) => g === "refresh_token")).toHaveLength(1);
  });
});
