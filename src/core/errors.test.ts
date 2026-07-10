import { describe, expect, it } from "bun:test";

import { errorCode, extractMissingPackage, isNoEntError } from "./errors.js";

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

describe("extractMissingPackage", () => {
  it("extracts the package name from an ESM resolution error", () => {
    const text =
      "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'date-fns' imported from /x/y.js";
    expect(extractMissingPackage(text)).toBe("date-fns");
  });

  it("extracts a scoped package name from a CJS resolution error", () => {
    expect(extractMissingPackage("Cannot find module '@faker-js/faker'")).toBe(
      "@faker-js/faker",
    );
  });

  it("returns undefined for non-resolution errors", () => {
    expect(extractMissingPackage("locator timeout")).toBeUndefined();
  });

  it("returns undefined for a relative file path specifier", () => {
    expect(
      extractMissingPackage(
        "Cannot find module './helper.js' imported from /x/y.js",
      ),
    ).toBeUndefined();
  });

  it("returns undefined for an absolute file path specifier", () => {
    expect(
      extractMissingPackage(
        "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/run/exec/helper.js' imported from /x/y.js",
      ),
    ).toBeUndefined();
  });

  it("returns undefined for a Windows drive-letter path specifier", () => {
    expect(
      extractMissingPackage("Cannot find module 'C:\\flows\\helper.js'"),
    ).toBeUndefined();
  });
});
