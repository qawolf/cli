import { describe, expect, it } from "bun:test";

import { swapSourceExtension } from "./swapSourceExtension.js";

describe("swapSourceExtension", () => {
  it("swaps .ts to .js", () => {
    expect(swapSourceExtension("../../../utilities/code-snippets.ts")).toBe(
      "../../../utilities/code-snippets.js",
    );
  });

  it("swaps .js to .ts", () => {
    expect(swapSourceExtension("../../../utilities/code-snippets.js")).toBe(
      "../../../utilities/code-snippets.ts",
    );
  });

  it("swaps .mts to .mjs", () => {
    expect(swapSourceExtension("./module.mts")).toBe("./module.mjs");
  });

  it("swaps .mjs to .mts", () => {
    expect(swapSourceExtension("./module.mjs")).toBe("./module.mts");
  });

  it("swaps .cts to .cjs", () => {
    expect(swapSourceExtension("./compat.cts")).toBe("./compat.cjs");
  });

  it("swaps .cjs to .cts", () => {
    expect(swapSourceExtension("./compat.cjs")).toBe("./compat.cts");
  });

  it("returns undefined for bare package specifier", () => {
    expect(swapSourceExtension("axios")).toBeUndefined();
  });

  it("returns undefined for scoped package specifier", () => {
    expect(swapSourceExtension("@qawolf/flows/web")).toBeUndefined();
  });

  it("returns undefined for extensionless relative path", () => {
    expect(swapSourceExtension("./foo")).toBeUndefined();
  });

  it("returns undefined for unknown extension", () => {
    expect(swapSourceExtension("./data.json")).toBeUndefined();
  });
});
