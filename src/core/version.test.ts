import { describe, expect, it } from "bun:test";

import { isNewerVersion } from "./version.js";

describe("isNewerVersion", () => {
  it("detects newer patch, minor, and major releases", () => {
    expect(isNewerVersion("1.3.2", "1.3.3")).toBe(true);
    expect(isNewerVersion("1.3.2", "1.4.0")).toBe(true);
    expect(isNewerVersion("1.3.2", "2.0.0")).toBe(true);
  });

  it("compares numerically, not lexicographically", () => {
    expect(isNewerVersion("1.9.0", "1.10.0")).toBe(true);
    expect(isNewerVersion("1.10.0", "1.9.0")).toBe(false);
  });

  it("returns false for equal or older versions", () => {
    expect(isNewerVersion("1.3.2", "1.3.2")).toBe(false);
    expect(isNewerVersion("1.3.2", "1.3.1")).toBe(false);
    expect(isNewerVersion("2.0.0", "1.9.9")).toBe(false);
  });

  it("returns false when either version is not a plain release", () => {
    expect(isNewerVersion("1.3.2", "1.4.0-beta.1")).toBe(false);
    expect(isNewerVersion("1.3.2-beta.1", "1.4.0")).toBe(false);
    expect(isNewerVersion("1.3.2", "not-a-version")).toBe(false);
    expect(isNewerVersion("", "1.4.0")).toBe(false);
  });
});
