import { describe, expect, it } from "bun:test";
import {
  avdNameForTarget,
  buildSystemImage,
  makeAvdName,
} from "./androidTargets.js";

describe("makeAvdName", () => {
  it("should produce qawolf-prefixed avd name with underscored model", () => {
    expect(makeAvdName("Pixel 9", "35")).toBe("qawolf_pixel_9_api35");
  });

  it("should replace spaces with underscores in multi-word model", () => {
    expect(makeAvdName("Pixel Tablet", "34")).toBe("qawolf_pixel_tablet_api34");
  });
});

describe("buildSystemImage", () => {
  it("should build arm64-v8a image path for arm64 arch and API 34", () => {
    expect(buildSystemImage("34", "arm64")).toBe(
      "system-images;android-34;google_apis_playstore;arm64-v8a",
    );
  });

  it("should build x86_64 image path for x64 arch", () => {
    expect(buildSystemImage("35", "x64")).toBe(
      "system-images;android-35;google_apis_playstore;x86_64",
    );
  });

  it("should throw for unsupported architectures", () => {
    expect(() => buildSystemImage("35", "ia32" as NodeJS.Architecture)).toThrow(
      "Unsupported host architecture for Android AVD: ia32",
    );
  });

  it("should use google_apis (no playstore) for API 36 and above", () => {
    expect(buildSystemImage("36", "arm64")).toBe(
      "system-images;android-36;google_apis;arm64-v8a",
    );
  });
});

describe("avdNameForTarget", () => {
  it("should return the AVD name for a fully-qualified Android target", () => {
    expect(avdNameForTarget("Android - Pixel 9 (Android 15)")).toBe(
      "qawolf_pixel_9_api35",
    );
  });

  it("should return the AVD name for the bare 'Android - Pixel' preset", () => {
    expect(avdNameForTarget("Android - Pixel")).toBe("qawolf_pixel_2_api34");
  });

  it("should return undefined for a non-Android target", () => {
    expect(avdNameForTarget("Web - Chrome")).toBeUndefined();
  });

  it("should return undefined for an unparseable string", () => {
    expect(avdNameForTarget("not-a-real-target")).toBeUndefined();
  });
});
