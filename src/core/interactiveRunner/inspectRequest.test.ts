import { describe, expect, it } from "bun:test";

import { buildInspectRequest } from "./inspectRequest.js";

const noFlags = { name: undefined, selector: undefined };

describe("buildInspectRequest", () => {
  it("carries a selector into an element request", () => {
    expect(
      buildInspectRequest("element-html", { ...noFlags, selector: "#email" }),
    ).toEqual({
      ok: true,
      request: { selector: "#email", what: "element-html" },
    });
  });

  it("omits the selector a page request was not given", () => {
    expect(buildInspectRequest("page-html", noFlags)).toEqual({
      ok: true,
      request: { what: "page-html" },
    });
  });

  it("names a variable rather than passing a selector", () => {
    expect(
      buildInspectRequest("variable", { ...noFlags, name: "cart" }),
    ).toEqual({
      ok: true,
      request: { variableName: "cart", what: "variable" },
    });
  });

  it("refuses an element request with no selector to match on", () => {
    const built = buildInspectRequest("element-html", noFlags);

    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.error).toContain("selector");
  });

  it("refuses a variable request with no name", () => {
    expect(buildInspectRequest("variable", noFlags).ok).toBe(false);
  });

  // The caps come from the published schema, so the CLI cannot drift from what
  // the server accepts.
  it("refuses a selector past the published length", () => {
    expect(
      buildInspectRequest("element-html", {
        ...noFlags,
        selector: "a".repeat(2_001),
      }).ok,
    ).toBe(false);
    expect(
      buildInspectRequest("element-html", {
        ...noFlags,
        selector: "a".repeat(2_000),
      }).ok,
    ).toBe(true);
  });

  it("refuses a variable name past the published length", () => {
    expect(
      buildInspectRequest("variable", { ...noFlags, name: "a".repeat(257) }).ok,
    ).toBe(false);
  });

  it("refuses an empty selector rather than sending one", () => {
    expect(
      buildInspectRequest("element-html", { ...noFlags, selector: "" }).ok,
    ).toBe(false);
  });
});
