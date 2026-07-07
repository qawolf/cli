import { describe, expect, it } from "bun:test";

import { selectFlowLoaderStrategy } from "./selectFlowLoaderStrategy.js";

describe("selectFlowLoaderStrategy", () => {
  it("does nothing under Bun (native TS + resolution)", () => {
    expect(
      selectFlowLoaderStrategy({
        isBun: true,
        hasSyncHooks: true,
        hasNativeTypeScript: false,
        hasAsyncRegister: true,
      }),
    ).toBe("none");
  });

  it("uses the sync extension-alias hook on Node with native TS stripping", () => {
    // Node 22.18+: strips types natively but does not rewrite import extensions.
    expect(
      selectFlowLoaderStrategy({
        isBun: false,
        hasSyncHooks: true,
        hasNativeTypeScript: true,
        hasAsyncRegister: true,
      }),
    ).toBe("sync-alias");
  });

  it("uses the oxc transpiling loader on Node 20 (no native TS)", () => {
    expect(
      selectFlowLoaderStrategy({
        isBun: false,
        hasSyncHooks: false,
        hasNativeTypeScript: false,
        hasAsyncRegister: true,
      }),
    ).toBe("oxc-transpile");
  });

  it("uses the oxc loader on Node 22.15-22.17 (sync hooks but no native TS)", () => {
    expect(
      selectFlowLoaderStrategy({
        isBun: false,
        hasSyncHooks: true,
        hasNativeTypeScript: false,
        hasAsyncRegister: true,
      }),
    ).toBe("oxc-transpile");
  });

  it("reports unsupported when Node cannot load TypeScript at all (Node < 20.6)", () => {
    expect(
      selectFlowLoaderStrategy({
        isBun: false,
        hasSyncHooks: false,
        hasNativeTypeScript: false,
        hasAsyncRegister: false,
      }),
    ).toBe("unsupported");
  });
});
