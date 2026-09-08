import { describe, expect, it } from "bun:test";

import { matchesSearchTerm, normalizeForSearch } from "./textSearch.js";

describe("normalizeForSearch", () => {
  it("collapses case and every separator to one spelling", () => {
    expect(normalizeForSearch("Acme_Retail")).toBe("acme retail");
    expect(normalizeForSearch("acme-retail")).toBe("acme retail");
    expect(normalizeForSearch("  Acme   Retail  ")).toBe("acme retail");
  });
});

describe("matchesSearchTerm", () => {
  const fields = ["Acme Retail", "acme-retail", "ws_01H9"];

  it("matches part of any field", () => {
    expect(matchesSearchTerm("retail", fields)).toBe(true);
    expect(matchesSearchTerm("ws_01", fields)).toBe(true);
  });

  it("ignores case", () => {
    expect(matchesSearchTerm("ACME", fields)).toBe(true);
  });

  // Someone reading a name types spaces; the slug they are matching has
  // hyphens. Both have to reach the same row.
  it("treats a typed space and a slug hyphen as the same separator", () => {
    expect(matchesSearchTerm("acme retail", ["acme-retail"])).toBe(true);
    expect(matchesSearchTerm("acme-retail", ["Acme Retail"])).toBe(true);
  });

  it("does not match what is absent", () => {
    expect(matchesSearchTerm("wholesale", fields)).toBe(false);
  });

  // Clearing the box must restore the list, not empty it.
  it("matches everything for an empty or blank search", () => {
    expect(matchesSearchTerm("", fields)).toBe(true);
    expect(matchesSearchTerm("   ", fields)).toBe(true);
  });

  // A blank search short-circuits, so this covers the other path: an absent
  // field must not behave like an empty string that contains anything.
  it("skips absent fields", () => {
    expect(matchesSearchTerm("acme", [undefined])).toBe(false);
    expect(matchesSearchTerm("acme", [undefined, "Acme"])).toBe(true);
  });
});
