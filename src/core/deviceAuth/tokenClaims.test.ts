import { describe, expect, it } from "bun:test";

import { readTokenClaims, verifyTokenBinding } from "./tokenClaims.js";

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function makeJwt(payload: unknown): string {
  return [
    base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" })),
    base64Url(JSON.stringify(payload)),
    "signature-is-not-checked-here",
  ].join(".");
}

const binding = {
  issuer: "https://signin.example",
  resource: "https://app.example/api",
};

const good = {
  iss: "https://signin.example",
  aud: "https://app.example/api",
  exp: 1_700_000_000,
  org_id: "org_1",
};

describe("verifyTokenBinding", () => {
  it("accepts a token whose audience is exactly the resource", () => {
    expect(verifyTokenBinding(makeJwt(good), binding)).toEqual({
      ok: true,
      expiresAt: 1_700_000_000_000,
      organizationId: "org_1",
    });
  });

  it("accepts an audience array that contains the exact resource", () => {
    const token = makeJwt({
      ...good,
      aud: ["https://app.example/api/mcp", "https://app.example/api"],
    });

    expect(verifyTokenBinding(token, binding).ok).toBe(true);
  });

  // The live failure: WorkOS answers the device grant with the environment
  // client id as the audience, which the API rejects.
  it("rejects a token whose audience is the environment client id", () => {
    const token = makeJwt({ ...good, aud: "client_01ENV" });

    expect(verifyTokenBinding(token, binding)).toEqual({
      ok: false,
      reason: "audience-mismatch",
    });
  });

  it("rejects an audience that differs only by a trailing slash", () => {
    const token = makeJwt({ ...good, aud: "https://app.example/api/" });

    expect(verifyTokenBinding(token, binding).ok).toBe(false);
  });

  it("rejects a token without an audience", () => {
    const { aud: _aud, ...withoutAud } = good;

    expect(verifyTokenBinding(makeJwt(withoutAud), binding)).toEqual({
      ok: false,
      reason: "audience-mismatch",
    });
  });

  it("rejects a token from another issuer", () => {
    const token = makeJwt({ ...good, iss: "https://other.example" });

    expect(verifyTokenBinding(token, binding)).toEqual({
      ok: false,
      reason: "issuer-mismatch",
    });
  });

  it("tolerates a trailing slash on either side of the issuer", () => {
    const token = makeJwt({ ...good, iss: "https://signin.example/" });

    expect(verifyTokenBinding(token, binding).ok).toBe(true);
    expect(
      verifyTokenBinding(makeJwt(good), {
        ...binding,
        issuer: "https://signin.example/",
      }).ok,
    ).toBe(true);
  });

  it("rejects a token that cannot be decoded", () => {
    expect(verifyTokenBinding("not.a.jwt.at.all", binding)).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(verifyTokenBinding("", binding)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("reports an unreadable expiry as unknown rather than failing", () => {
    const token = makeJwt({ ...good, exp: "soon" });

    expect(verifyTokenBinding(token, binding)).toEqual({
      ok: true,
      expiresAt: undefined,
      organizationId: "org_1",
    });
  });

  it("leaves the organization undefined when the token names none", () => {
    const { org_id: _org, ...withoutOrg } = good;

    const result = verifyTokenBinding(makeJwt(withoutOrg), binding);

    if (!result.ok) throw Error("expected ok");
    expect(result.organizationId).toBeUndefined();
  });
});

describe("readTokenClaims", () => {
  it("returns undefined for anything that is not a three-segment token", () => {
    expect(readTokenClaims("nope")).toBeUndefined();
  });

  it("returns undefined when the payload is not a JSON object", () => {
    const token = ["h", base64Url("[1,2]"), "s"].join(".");

    expect(readTokenClaims(token)).toBeUndefined();
  });

  it("returns the decoded payload otherwise", () => {
    expect(readTokenClaims(makeJwt({ sub: "user_1" }))).toEqual({
      sub: "user_1",
    });
  });
});
