import { describe, expect, it } from "bun:test";

import { parseRunBuilds } from "./runBuilds.js";

const buildId = "abcdefghij0123456789klmnobld";

describe("parseRunBuilds", () => {
  it("sends no builds when none are named", () => {
    expect(parseRunBuilds([])).toEqual({ builds: undefined, ok: true });
  });

  it("keeps each build id", () => {
    expect(parseRunBuilds([buildId])).toEqual({
      builds: [buildId],
      ok: true,
    });
  });

  it("refuses a value that is not a build id", () => {
    expect(parseRunBuilds([buildId, "flows/checkout.flow.ts"])).toEqual({
      error: "✖ Expected a build id from build.requestUpload.\n  → at [1]",
      ok: false,
    });
  });

  it("refuses more builds than a run takes", () => {
    expect(parseRunBuilds(Array.from({ length: 21 }, () => buildId))).toEqual({
      error: "✖ Too big: expected array to have <=20 items",
      ok: false,
    });
  });
});
