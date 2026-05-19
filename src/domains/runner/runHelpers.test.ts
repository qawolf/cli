import { describe, expect, it } from "bun:test";

import { buildRunOptions } from "./runHelpers.js";
import { defaultFlags } from "./run.fixtures.js";

describe("buildRunOptions", () => {
  it("passes headed: false to webOptions when flag is false", () => {
    const { webOptions } = buildRunOptions({
      ...defaultFlags(),
      headed: false,
    });
    expect(webOptions.headed).toBe(false);
  });

  it("passes headed: true to webOptions when --headed flag is set", () => {
    const { webOptions } = buildRunOptions({ ...defaultFlags(), headed: true });
    expect(webOptions.headed).toBe(true);
  });
});
