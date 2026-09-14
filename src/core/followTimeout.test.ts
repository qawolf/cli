import { describe, expect, it } from "bun:test";

import { parseFollowTimeout } from "./followTimeout.js";

describe("parseFollowTimeout", () => {
  it("answers with the default when no timeout was given", () => {
    expect(parseFollowTimeout(undefined, 600)).toEqual({
      ok: true,
      seconds: 600,
    });
  });

  it("reads a positive whole number of seconds", () => {
    expect(parseFollowTimeout("90", 600)).toEqual({ ok: true, seconds: 90 });
  });

  it("refuses anything that is not a positive whole number", () => {
    expect(parseFollowTimeout("soon", 600).ok).toBe(false);
    expect(parseFollowTimeout("0", 600).ok).toBe(false);
    expect(parseFollowTimeout("1.5", 600).ok).toBe(false);
  });
});
