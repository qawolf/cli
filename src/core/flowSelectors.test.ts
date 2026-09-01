import { describe, expect, it } from "bun:test";

import { hasSelectors, matchesSelectors } from "./flowSelectors.js";

const flow = { tags: ["auth", "smoke"] as readonly string[] | undefined };

describe("hasSelectors", () => {
  it("is false when no selector is given", () => {
    expect(hasSelectors({ tags: [] })).toBe(false);
  });

  it("is true when a selector is given", () => {
    expect(hasSelectors({ tags: ["auth"] })).toBe(true);
  });
});

describe("matchesSelectors", () => {
  it("matches everything when no selector is given", () => {
    expect(matchesSelectors(flow, { tags: [] })).toBe(true);
  });

  it("matches any of the given tags", () => {
    expect(matchesSelectors(flow, { tags: ["auth"] })).toBe(true);
    expect(matchesSelectors(flow, { tags: ["nope", "smoke"] })).toBe(true);
    expect(matchesSelectors(flow, { tags: ["nope"] })).toBe(false);
  });

  it("matches strictly, ignoring case and separator differences", () => {
    expect(matchesSelectors(flow, { tags: ["AUTH"] })).toBe(false);
  });

  // Unknown tags are not the same as no tags: a flow whose tags could not be
  // determined must not satisfy a tag selector.
  it("never matches when tags are unknown", () => {
    expect(matchesSelectors({ tags: undefined }, { tags: ["auth"] })).toBe(
      false,
    );
  });

  it("does not match a flow known to carry no tags", () => {
    expect(matchesSelectors({ tags: [] }, { tags: ["auth"] })).toBe(false);
  });
});
