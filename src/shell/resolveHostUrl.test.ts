import { describe, expect, it } from "bun:test";

import { resolveHostUrl } from "./resolveHostUrl.js";

describe("resolveHostUrl", () => {
  it("returns the production host when QAWOLF_HOST_URL is unset", () => {
    expect(resolveHostUrl({})).toBe("https://app.qawolf.com");
  });

  it("accepts a custom host", () => {
    expect(
      resolveHostUrl({
        QAWOLF_HOST_URL: "https://app.preview.example.com",
      }),
    ).toBe("https://app.preview.example.com");
  });

  it("does not treat QAWOLF_API_URL as the host URL", () => {
    expect(
      resolveHostUrl({
        QAWOLF_API_URL: "https://api.staging.example.com/api",
      }),
    ).toBe("https://app.qawolf.com");
  });

  it("trims whitespace and trailing slashes", () => {
    expect(
      resolveHostUrl({
        QAWOLF_HOST_URL: "  http://localhost:3000///  ",
      }),
    ).toBe("http://localhost:3000");
  });

  it("falls back to the production host for whitespace", () => {
    expect(resolveHostUrl({ QAWOLF_HOST_URL: "  " })).toBe(
      "https://app.qawolf.com",
    );
  });
});
