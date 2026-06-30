import { describe, expect, it } from "bun:test";

import { errorCode, isNoEntError } from "./errors.js";

describe("errorCode", () => {
  it("returns the string code of an error-like value", () => {
    expect(errorCode(Object.assign(Error("boom"), { code: "ENOENT" }))).toBe(
      "ENOENT",
    );
    expect(errorCode({ code: "ERR_MODULE_NOT_FOUND" })).toBe(
      "ERR_MODULE_NOT_FOUND",
    );
  });

  it("returns undefined when no code is present", () => {
    expect(errorCode(Error("boom"))).toBeUndefined();
    expect(errorCode({})).toBeUndefined();
  });

  it("returns undefined for a non-string code", () => {
    expect(errorCode({ code: 42 })).toBeUndefined();
  });

  it("returns undefined for nullish or primitive values", () => {
    // oxlint-disable-next-line no-null -- exercises the `err === null` guard branch
    expect(errorCode(null)).toBeUndefined();
    expect(errorCode(undefined)).toBeUndefined();
    expect(errorCode("ENOENT")).toBeUndefined();
  });
});

describe("isNoEntError", () => {
  it("is true only when the code is ENOENT", () => {
    expect(isNoEntError({ code: "ENOENT" })).toBe(true);
    expect(isNoEntError({ code: "EACCES" })).toBe(false);
    expect(isNoEntError(Error("boom"))).toBe(false);
  });
});
