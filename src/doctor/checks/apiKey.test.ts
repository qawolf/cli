import { describe, expect, it } from "bun:test";

import { checkApiKey } from "./apiKey.js";

describe("checkApiKey", () => {
  it("passes when QAWOLF_API_KEY is set", async () => {
    const r = await checkApiKey({ env: { QAWOLF_API_KEY: "x" } });
    expect(r).toEqual({ name: "api-key", status: "pass" });
  });

  it("warns when QAWOLF_API_KEY is unset", async () => {
    const r = await checkApiKey({ env: {} });
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("not set");
  });

  it("warns when QAWOLF_API_KEY is whitespace", async () => {
    const r = await checkApiKey({ env: { QAWOLF_API_KEY: "   " } });
    expect(r.status).toBe("warn");
  });
});
