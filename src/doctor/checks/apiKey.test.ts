import { describe, expect, it } from "bun:test";

import { checkApiKey } from "./apiKey.js";

describe("checkApiKey", () => {
  it("passes when an api key is provided", async () => {
    const r = await checkApiKey({ apiKey: "qawolf_test_key" });
    expect(r).toEqual({ name: "api-key", status: "pass" });
  });

  it("warns when no api key is found", async () => {
    const r = await checkApiKey({ apiKey: undefined });
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("qawolf auth login");
  });
});
