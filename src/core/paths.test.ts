import { describe, expect, it } from "bun:test";

import { defaultOutputDir, qawolfDir } from "./paths.js";

describe("defaultOutputDir", () => {
  it("is nested inside the qawolf directory that init gitignores", () => {
    expect(defaultOutputDir.startsWith(`${qawolfDir}/`)).toBe(true);
  });

  it("is a relative path so artifacts land in the project, not an absolute location", () => {
    expect(defaultOutputDir.startsWith("/")).toBe(false);
  });
});
