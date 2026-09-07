import { mock } from "bun:test";

import type { WorkosDeps } from "./types.js";

export function createFetchMock(resolvedValue: Response) {
  return mock<typeof fetch>().mockResolvedValue(
    resolvedValue,
  ) as unknown as typeof fetch;
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

export function makeJwt(payload: unknown): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return [encode({ alg: "RS256" }), encode(payload), "sig"].join(".");
}

export const testIssuer = "https://signin.example";
export const testResource = "https://app.example/api";

/** A token the API would accept: bound to the issuer and the API resource. */
export const boundAccessToken = makeJwt({
  iss: testIssuer,
  aud: testResource,
  exp: 1_700_000_000,
  org_id: "org_1",
});

export const testDeps: Omit<WorkosDeps, "fetch"> = {
  clientId: "client_123",
  resource: testResource,
  endpoints: {
    deviceAuthorization: "https://signin.example/oauth2/device_authorization",
    token: "https://signin.example/oauth2/token",
  },
};
