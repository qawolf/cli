import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import {
  adbBin,
  avdManagerBin,
  emulatorBin,
  sdkManagerBin,
} from "./androidBins.js";

describe("emulatorBin", () => {
  const home = join("/opt", "android-sdk");

  it("returns the extension-less path on linux and macOS", () => {
    expect(emulatorBin(home, "linux")).toBe(join(home, "emulator", "emulator"));
    expect(emulatorBin(home, "darwin")).toBe(
      join(home, "emulator", "emulator"),
    );
  });

  it("returns emulator.exe on win32", () => {
    expect(emulatorBin(home, "win32")).toBe(
      join(home, "emulator", "emulator.exe"),
    );
  });

  it("falls back to the bare name on PATH when ANDROID_HOME is unset", () => {
    expect(emulatorBin(undefined, "linux")).toBe("emulator");
    expect(emulatorBin(undefined, "win32")).toBe("emulator.exe");
  });
});

describe("adbBin", () => {
  const home = join("/opt", "android-sdk");

  it("returns the extension-less path on linux and macOS", () => {
    expect(adbBin(home, "linux")).toBe(join(home, "platform-tools", "adb"));
  });

  it("returns adb.exe on win32", () => {
    expect(adbBin(home, "win32")).toBe(join(home, "platform-tools", "adb.exe"));
  });

  it("falls back to the bare name on PATH when ANDROID_HOME is unset", () => {
    expect(adbBin(undefined, "linux")).toBe("adb");
    expect(adbBin(undefined, "win32")).toBe("adb.exe");
  });
});

describe("sdkManagerBin and avdManagerBin", () => {
  const home = join("/opt", "android-sdk");
  const binDir = join(home, "cmdline-tools", "latest", "bin");

  it("returns the extension-less scripts on linux and macOS", () => {
    expect(sdkManagerBin(home, "linux")).toBe(join(binDir, "sdkmanager"));
    expect(avdManagerBin(home, "darwin")).toBe(join(binDir, "avdmanager"));
  });

  it("returns the .bat wrappers on win32", () => {
    expect(sdkManagerBin(home, "win32")).toBe(join(binDir, "sdkmanager.bat"));
    expect(avdManagerBin(home, "win32")).toBe(join(binDir, "avdmanager.bat"));
  });
});
