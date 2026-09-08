import { describe, expect, it } from "bun:test";

import {
  createSearchIndex,
  matchesSearchTerm,
  normalizeForSearch,
} from "./textSearch.js";

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

describe("createSearchIndex", () => {
  const items = [
    { name: "Acme Retail", slug: "acme-retail", id: "ws_01" },
    { name: "Globex Wholesale", slug: "globex-wholesale", id: "ws_02" },
  ];
  const fieldsOf = (i: (typeof items)[number]) => [i.name, i.slug, i.id];

  it("matches the same things as a direct call", () => {
    const match = createSearchIndex(items, fieldsOf);

    expect(match("acme", items[0]!)).toBe(true);
    // Typed with a space, stored with a hyphen.
    expect(match("acme retail", items[0]!)).toBe(true);
    expect(match("WS_02", items[1]!)).toBe(true);
    expect(match("acme", items[1]!)).toBe(false);
  });

  it("shows the whole list for a blank search", () => {
    const match = createSearchIndex(items, fieldsOf);

    expect(match("", items[0]!)).toBe(true);
    expect(match("  ", items[1]!)).toBe(true);
  });

  // The search text is normalized once per term rather than once per item, so
  // the terms have to keep working when they change back and forth.
  it("keeps answering correctly as the search term changes", () => {
    const match = createSearchIndex(items, fieldsOf);

    expect(match("acme", items[0]!)).toBe(true);
    expect(match("globex", items[0]!)).toBe(false);
    expect(match("globex", items[1]!)).toBe(true);
    expect(match("acme", items[0]!)).toBe(true);
  });

  // Falling back rather than reporting no match: a caller that filters a list
  // it did not index still deserves the right answer.
  it("still matches an item that was never indexed", () => {
    const match = createSearchIndex(items, fieldsOf);
    const stranger = { name: "Initech", slug: "initech", id: "ws_03" };

    expect(match("initech", stranger)).toBe(true);
    expect(match("acme", stranger)).toBe(false);
  });

  it("skips absent fields", () => {
    const sparse = [{ name: undefined, slug: "only-slug", id: "ws_04" }];
    const match = createSearchIndex(sparse, (i) => [i.name, i.slug, i.id]);

    expect(match("only slug", sparse[0]!)).toBe(true);
    expect(match("missing", sparse[0]!)).toBe(false);
  });
});
