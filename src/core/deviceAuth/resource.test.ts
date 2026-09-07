import { describe, expect, it } from "bun:test";

import { apiResource, sameIssuer } from "./resource.js";

describe("apiResource", () => {
  it("is the deployment origin followed by /api", () => {
    expect(apiResource("https://app.qawolf.com")).toBe(
      "https://app.qawolf.com/api",
    );
  });

  it("keeps the port, which is part of the deployment's identity", () => {
    expect(apiResource("http://localhost:3000")).toBe(
      "http://localhost:3000/api",
    );
  });

  it("does not double a slash the host url carries", () => {
    expect(apiResource("https://app.qawolf.com/")).toBe(
      "https://app.qawolf.com/api",
    );
  });

  it("ignores a path on the host url; the resource is the origin's", () => {
    expect(apiResource("https://app.qawolf.com/some/page")).toBe(
      "https://app.qawolf.com/api",
    );
  });
});

describe("sameIssuer", () => {
  it("matches an issuer regardless of a trailing slash", () => {
    expect(
      sameIssuer("https://signin.example/", "https://signin.example"),
    ).toBe(true);
  });

  it("does not match a different host", () => {
    expect(sameIssuer("https://signin.example", "https://other.example")).toBe(
      false,
    );
  });

  it("does not match a different scheme", () => {
    expect(sameIssuer("http://signin.example", "https://signin.example")).toBe(
      false,
    );
  });
});
