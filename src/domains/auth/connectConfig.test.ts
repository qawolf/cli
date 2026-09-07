import { describe, expect, it } from "bun:test";

import { resolveConnectConfig } from "./connectConfig.js";

const apiBaseUrl = "https://app.example";
const issuer = "https://signin.example";

const authConfig = {
  workOsClientId: "client_01ENV",
  authorizationServer: issuer,
  workOsConnectClientId: "client_01CONNECT",
};

const metadata = {
  issuer,
  device_authorization_endpoint: `${issuer}/oauth2/device_authorization`,
  token_endpoint: `${issuer}/oauth2/token`,
};

/** Answers by URL, so the test states what each server publishes. */
function routingFetch(
  routes: Record<string, () => Response | Promise<Response>>,
) {
  const calls: string[] = [];
  const fetchFn = (async (input: string) => {
    const url = input;
    calls.push(url);
    const route = routes[url];
    if (!route) return new Response("not found", { status: 404 });
    return route();
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

describe("resolveConnectConfig", () => {
  it("assembles the issuer, Connect client, resource and endpoints", async () => {
    const { fetchFn } = routingFetch({
      [`${apiBaseUrl}/api/v0/auth/config`]: () => Response.json(authConfig),
      [`${issuer}/.well-known/oauth-authorization-server`]: () =>
        Response.json(metadata),
    });

    const result = await resolveConnectConfig({ apiBaseUrl, fetch: fetchFn });

    expect(result).toEqual({
      kind: "configured",
      config: {
        issuer,
        clientId: "client_01CONNECT",
        resource: "https://app.example/api",
        endpoints: {
          deviceAuthorization: `${issuer}/oauth2/device_authorization`,
          token: `${issuer}/oauth2/token`,
        },
      },
    });
  });

  it("asks the deployment before the issuer, and the issuer only once configured", async () => {
    const { calls, fetchFn } = routingFetch({
      [`${apiBaseUrl}/api/v0/auth/config`]: () =>
        Response.json({ workOsClientId: "client_01ENV" }),
    });

    const result = await resolveConnectConfig({ apiBaseUrl, fetch: fetchFn });

    expect(result).toEqual({ kind: "legacy-only" });
    expect(calls).toEqual([`${apiBaseUrl}/api/v0/auth/config`]);
  });

  it("reports a deployment that offers no browser sign-in", async () => {
    const { fetchFn } = routingFetch({});

    const result = await resolveConnectConfig({ apiBaseUrl, fetch: fetchFn });

    expect(result).toEqual({ kind: "unavailable" });
  });

  it("passes a half configuration through as misconfigured", async () => {
    const { fetchFn } = routingFetch({
      [`${apiBaseUrl}/api/v0/auth/config`]: () =>
        Response.json({ ...authConfig, authorizationServer: undefined }),
    });

    const result = await resolveConnectConfig({ apiBaseUrl, fetch: fetchFn });

    expect(result.kind).toBe("misconfigured");
  });

  it("reports an unreachable deployment as such", async () => {
    const result = await resolveConnectConfig({
      apiBaseUrl,
      fetch: (async () => {
        throw Error("connect ECONNREFUSED");
      }) as unknown as typeof fetch,
    });

    if (result.kind !== "unreachable") throw Error("expected unreachable");
    expect(result.detail).toContain("ECONNREFUSED");
  });

  it("reports an issuer that will not serve metadata as a configuration fault", async () => {
    const { fetchFn } = routingFetch({
      [`${apiBaseUrl}/api/v0/auth/config`]: () => Response.json(authConfig),
      [`${issuer}/.well-known/oauth-authorization-server`]: () =>
        Response.json({ ...metadata, issuer: "https://other.example" }),
    });

    const result = await resolveConnectConfig({ apiBaseUrl, fetch: fetchFn });

    if (result.kind !== "discovery-failed") {
      throw Error(`expected discovery-failed, got ${result.kind}`);
    }
    expect(result.detail).toContain("issuer");
  });

  it("reports an issuer that is down as unreachable, not misconfigured", async () => {
    const { fetchFn } = routingFetch({
      [`${apiBaseUrl}/api/v0/auth/config`]: () => Response.json(authConfig),
      [`${issuer}/.well-known/oauth-authorization-server`]: () =>
        Response.json({ error: "boom" }, { status: 503 }),
    });

    const result = await resolveConnectConfig({ apiBaseUrl, fetch: fetchFn });

    expect(result.kind).toBe("unreachable");
  });

  it("derives the resource from the deployment url, port included", async () => {
    const localBase = "http://localhost:3000";
    const { fetchFn } = routingFetch({
      [`${localBase}/api/v0/auth/config`]: () => Response.json(authConfig),
      [`${issuer}/.well-known/oauth-authorization-server`]: () =>
        Response.json(metadata),
    });

    const result = await resolveConnectConfig({
      apiBaseUrl: localBase,
      fetch: fetchFn,
    });

    if (result.kind !== "configured") throw Error("expected configured");
    expect(result.config.resource).toBe("http://localhost:3000/api");
  });
});
