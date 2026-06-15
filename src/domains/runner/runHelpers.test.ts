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

  it("passes the trace mode through to webOptions", () => {
    const { webOptions } = buildRunOptions({ ...defaultFlags(), trace: "on" });
    expect(webOptions.trace).toBe("on");
  });
});
