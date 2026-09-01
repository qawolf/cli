import { describe, expect, it } from "bun:test";

import { suggestNearMiss } from "./suggestNearMiss.js";

describe("suggestNearMiss", () => {
  // The map UI prettifies folder names for display, so a name read off the
  // screen ("Smoke Tests") does not match the folder it came from.
  it("suggests a candidate that differs only in case and separators", () => {
    expect(suggestNearMiss("Smoke Tests", ["smoke-tests", "auth"])).toBe(
      "smoke-tests",
    );
    expect(suggestNearMiss("smoke_tests", ["smoke-tests"])).toBe("smoke-tests");
  });

  it("suggests a candidate one or two characters away", () => {
    expect(suggestNearMiss("aut", ["auth", "checkout"])).toBe("auth");
    expect(suggestNearMiss("chekout", ["auth", "checkout"])).toBe("checkout");
  });

  it("returns undefined when nothing is close", () => {
    expect(suggestNearMiss("billing", ["auth", "checkout"])).toBeUndefined();
  });

  it("returns undefined for an exact match", () => {
    expect(suggestNearMiss("auth", ["auth", "checkout"])).toBeUndefined();
  });

  it("returns undefined when there are no candidates", () => {
    expect(suggestNearMiss("auth", [])).toBeUndefined();
  });

  it("prefers the closest candidate and breaks ties deterministically", () => {
    expect(suggestNearMiss("aut", ["auth", "out", "aut1"])).toBe("aut1");
    expect(suggestNearMiss("bxx", ["axx", "cxx"])).toBe("axx");
  });

  it("does not suggest a short candidate on a single-character overlap", () => {
    expect(suggestNearMiss("ab", ["xy"])).toBeUndefined();
  });
});
