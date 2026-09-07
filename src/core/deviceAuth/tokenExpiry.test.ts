import { describe, expect, it } from "bun:test";

import { readAccessTokenExpiry } from "./tokenExpiry.js";

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

describe("readAccessTokenExpiry", () => {
  it("converts the exp claim from seconds to epoch milliseconds", () => {
    const token = makeJwt({ exp: 1_700_000_000, sub: "user_1" });

    expect(readAccessTokenExpiry(token)).toBe(1_700_000_000_000);
  });

  it("returns undefined when the payload carries no exp claim", () => {
    expect(readAccessTokenExpiry(makeJwt({ sub: "user_1" }))).toBeUndefined();
  });

  it("returns undefined when exp is not a number", () => {
    expect(readAccessTokenExpiry(makeJwt({ exp: "soon" }))).toBeUndefined();
  });

  it("returns undefined for a token that is not three segments", () => {
    expect(readAccessTokenExpiry("not.ajwt")).toBeUndefined();
  });

  it("returns undefined when the payload segment is not JSON", () => {
    const token = ["header", base64Url("not json at all"), "sig"].join(".");

    expect(readAccessTokenExpiry(token)).toBeUndefined();
  });

  it("returns undefined for an empty token", () => {
    expect(readAccessTokenExpiry("")).toBeUndefined();
  });

  it("decodes payloads containing base64url-only characters", () => {
    // A payload whose base64 encoding needs - and _ rather than + and /.
    const token = makeJwt({ exp: 1_700_000_001, note: "??~~??>>>" });

    expect(readAccessTokenExpiry(token)).toBe(1_700_000_001_000);
  });
});
