import { describe, expect, it } from "bun:test";

import { detectRuntimeCapabilities } from "./detectRuntimeCapabilities.js";

describe("detectRuntimeCapabilities", () => {
  it("reports Bun when running under Bun", () => {
    // The test runner is Bun, so this exercises the real detection path.
    const caps = detectRuntimeCapabilities();
    expect(caps.isBun).toBe(true);
  });

  it("returns a boolean for every capability", () => {
    const caps = detectRuntimeCapabilities();
    expect(typeof caps.hasSyncHooks).toBe("boolean");
    expect(typeof caps.hasNativeTypeScript).toBe("boolean");
    expect(typeof caps.hasAsyncRegister).toBe("boolean");
  });
});
