import { describe, expect, it } from "bun:test";

import {
  errorCode,
  extractMissingSpecifier,
  isNoEntError,
  isTimeoutError,
} from "./errors.js";

describe("isTimeoutError", () => {
  it("recognizes the abort a reached AbortSignal.timeout throws", () => {
    expect(
      isTimeoutError(
        new DOMException("The operation timed out.", "TimeoutError"),
      ),
    ).toBe(true);
  });

  it("does not claim a failed connection or a caller's abort", () => {
    expect(isTimeoutError(new TypeError("fetch failed"))).toBe(false);
    expect(
      isTimeoutError(
        new DOMException("This operation was aborted", "AbortError"),
      ),
    ).toBe(false);
    expect(isTimeoutError("TimeoutError")).toBe(false);
  });
});

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

describe("extractMissingSpecifier", () => {
  it("extracts the package name from an ESM resolution error", () => {
    const text =
      "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'date-fns' imported from /x/y.js";
    expect(extractMissingSpecifier(text)).toEqual({
      kind: "package",
      specifier: "date-fns",
    });
  });

  it("extracts a scoped package name from a CJS resolution error", () => {
    expect(
      extractMissingSpecifier("Cannot find module '@faker-js/faker'"),
    ).toEqual({ kind: "package", specifier: "@faker-js/faker" });
  });

  it("reads a bare specifier naming a source file as a path alias", () => {
    const text =
      "Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@utilities/gpt-helpers.ts' imported from /run/exec/src/pages/admin.ts";
    expect(extractMissingSpecifier(text)).toEqual({
      kind: "path-alias",
      specifier: "@utilities/gpt-helpers.ts",
    });
  });

  it("reads every source extension a flow project can import as a path alias", () => {
    for (const extension of [
      ".ts",
      ".tsx",
      ".mts",
      ".cts",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
    ]) {
      expect(
        extractMissingSpecifier(`Cannot find package '~/helper${extension}'`),
      ).toEqual({ kind: "path-alias", specifier: `~/helper${extension}` });
    }
  });

  it("returns undefined for non-resolution errors", () => {
    expect(extractMissingSpecifier("locator timeout")).toBeUndefined();
  });

  it("returns undefined for a relative file path specifier", () => {
    expect(
      extractMissingSpecifier(
        "Cannot find module './helper.js' imported from /x/y.js",
      ),
    ).toBeUndefined();
  });

  it("returns undefined for an absolute file path specifier", () => {
    expect(
      extractMissingSpecifier(
        "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/run/exec/helper.js' imported from /x/y.js",
      ),
    ).toBeUndefined();
  });

  it("returns undefined for a Windows drive-letter path specifier", () => {
    expect(
      extractMissingSpecifier("Cannot find module 'C:\\flows\\helper.js'"),
    ).toBeUndefined();
  });
});
