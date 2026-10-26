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

  it("names a flow file given after --builds", () => {
    expect(parseRunBuilds([buildId, "flows/checkout.flow.ts"])).toEqual({
      error:
        "`flows/checkout.flow.ts` is not a build id. Put the flow file before `--builds`.",
      ok: false,
    });
  });
});
