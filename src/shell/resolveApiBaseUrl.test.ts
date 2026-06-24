import { describe, expect, it } from "bun:test";
import { resolveApiBaseUrl } from "./resolveApiBaseUrl.js";

describe("resolveApiBaseUrl", () => {
  it("returns the production default when QAWOLF_API_URL is unset", () => {
    expect(resolveApiBaseUrl({})).toBe("https://app.qawolf.com");
  });

  it("uses QAWOLF_API_URL when set", () => {
    expect(
      resolveApiBaseUrl({ QAWOLF_API_URL: "https://staging.example.com" }),
    ).toBe("https://staging.example.com");
  });

  it("trims trailing slashes", () => {
    expect(
      resolveApiBaseUrl({ QAWOLF_API_URL: "https://x.example.com///" }),
    ).toBe("https://x.example.com");
  });

  it("falls back to the default for an empty string", () => {
    expect(resolveApiBaseUrl({ QAWOLF_API_URL: "" })).toBe(
      "https://app.qawolf.com",
    );
  });
});
