import { describe, expect, it } from "vitest";

import { validateApiKey } from "./validate.js";

describe("validateApiKey", () => {
  it("returns invalid for empty key", async () => {
    const result = await validateApiKey("");
    expect(result).toEqual({ valid: false, error: "API key is empty" });
  });

  it("returns invalid for whitespace-only key", async () => {
    const result = await validateApiKey("   ");
    expect(result).toEqual({ valid: false, error: "API key is empty" });
  });

  it("returns valid for non-empty key (stub)", async () => {
    const result = await validateApiKey("qaw_test_key");
    expect(result).toEqual({ valid: true, teamName: "unknown" });
  });
});
