import { describe, expect, it } from "bun:test";

import { makeCtx } from "~/shell/commandContext.testUtils.js";

import { noMatchResult } from "./noMatch.js";

describe("noMatchResult", () => {
  it("returns the error at exit 2 when allowNoMatch is false", () => {
    const ctx = makeCtx();

    const result = noMatchResult(ctx, {
      allowNoMatch: false,
      error: "nothing matched",
      notice: "No flows matched.",
    });

    expect(result).toEqual({ error: "nothing matched", exitCode: 2 });
    expect(ctx.ui.info).not.toHaveBeenCalled();
  });

  it("prints the notice and returns success when allowNoMatch is true", () => {
    const ctx = makeCtx();

    const result = noMatchResult(ctx, {
      allowNoMatch: true,
      error: "nothing matched",
      notice: "No flows matched.",
    });

    expect(result).toBeUndefined();
    expect(ctx.ui.info).toHaveBeenCalledWith("No flows matched.");
  });

  it("stays silent when allowNoMatch is true and the caller passes no notice", () => {
    const ctx = makeCtx();

    const result = noMatchResult(ctx, {
      allowNoMatch: true,
      error: "nothing matched",
      notice: undefined,
    });

    expect(result).toBeUndefined();
    expect(ctx.ui.info).not.toHaveBeenCalled();
  });
});
