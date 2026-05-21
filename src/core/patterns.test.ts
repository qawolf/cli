import { describe, expect, it } from "bun:test";

import { buildPatternArgs } from "./patterns.js";

describe("buildPatternArgs", () => {
  it("wraps a pattern string in an array", () => {
    expect(buildPatternArgs("tests/login.flow.ts")).toEqual([
      "tests/login.flow.ts",
    ]);
  });

  it("returns an empty array when pattern is undefined", () => {
    expect(buildPatternArgs(undefined)).toEqual([]);
  });
});
