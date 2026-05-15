import { describe, expect, it } from "bun:test";
import { classifyTarget, isAndroidTarget } from "./expand.js";

describe("classifyTarget", () => {
  it("should return { kind: 'web', browser } for a web preset target", () => {
    expect(classifyTarget("Web - Chrome")).toEqual({
      kind: "web",
      browser: "chromium",
    });
  });

  it("should return { kind: 'android' } for an Android preset target", () => {
    expect(classifyTarget("Android - Pixel")).toEqual({ kind: "android" });
  });

  it("should return undefined for an unsupported target", () => {
    expect(classifyTarget("iOS - iPad")).toBeUndefined();
  });

  it("should return undefined for an unrecognised target string", () => {
    expect(classifyTarget("not-a-real-target")).toBeUndefined();
  });
});

describe("isAndroidTarget", () => {
  it("should return true when target platform is android", () => {
    expect(isAndroidTarget("Android - Pixel")).toBe(true);
  });

  it("should return false when target platform is web", () => {
    expect(isAndroidTarget("Web - Chrome")).toBe(false);
  });

  it("should return false when target platform is iOS", () => {
    expect(isAndroidTarget("iOS - iPad")).toBe(false);
  });

  it("should return false for an unrecognised target string", () => {
    expect(isAndroidTarget("not-a-real-target")).toBe(false);
  });
});
