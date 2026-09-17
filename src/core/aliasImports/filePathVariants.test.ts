import { describe, expect, it } from "bun:test";

import { filePathVariants } from "./filePathVariants.js";

describe("filePathVariants", () => {
  it("tries the other source extension for a path that names one", () => {
    expect(filePathVariants("src/utilities/gptHelpers.ts")).toEqual([
      "src/utilities/gptHelpers.ts",
      "src/utilities/gptHelpers.js",
    ]);
  });

  it("resolves a .js specifier to its TypeScript source", () => {
    expect(filePathVariants("src/pages/login.js")).toEqual([
      "src/pages/login.js",
      "src/pages/login.ts",
    ]);
  });

  it("adds index candidates only for an extensionless path", () => {
    expect(filePathVariants("src/pages/login")).toEqual([
      "src/pages/login",
      "src/pages/login.js",
      "src/pages/login.ts",
      "src/pages/login/index.js",
      "src/pages/login/index.ts",
    ]);
  });
});
