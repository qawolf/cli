import { describe, expect, it } from "vitest";

import { getApiBaseUrl } from "./config.js";

describe("getApiBaseUrl", () => {
  it("returns the default URL when QAWOLF_API_URL is not set", () => {
    expect(getApiBaseUrl({})).toBe("https://app.qawolf.com");
  });

  it("returns the default URL when QAWOLF_API_URL is empty", () => {
    expect(getApiBaseUrl({ QAWOLF_API_URL: "" })).toBe(
      "https://app.qawolf.com",
    );
  });

  it("returns the env URL when QAWOLF_API_URL is set", () => {
    expect(
      getApiBaseUrl({ QAWOLF_API_URL: "https://staging.qawolf.com" }),
    ).toBe("https://staging.qawolf.com");
  });

  it("strips trailing slashes from the env URL", () => {
    expect(
      getApiBaseUrl({ QAWOLF_API_URL: "https://staging.qawolf.com///" }),
    ).toBe("https://staging.qawolf.com");
  });
});
