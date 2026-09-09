import { describe, expect, it } from "bun:test";

import { resolveWorkosConfig } from "./config.js";

describe("resolveWorkosConfig", () => {
  it("points at WorkOS with the client id the deployment published", () => {
    expect(resolveWorkosConfig("client_1")).toEqual({
      configured: true,
      clientId: "client_1",
      baseUrl: "https://api.workos.com",
    });
  });

  it("reports browser sign-in unavailable when the deployment published none", () => {
    // A deployment that predates the config route, or serves no client id.
    expect(resolveWorkosConfig(undefined)).toEqual({ configured: false });
  });

  it("treats a blank client id as none", () => {
    expect(resolveWorkosConfig("   ")).toEqual({ configured: false });
  });
});
