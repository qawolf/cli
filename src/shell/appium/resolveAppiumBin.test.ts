import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { resolveAppiumBin } from "./resolveAppiumBin.js";

describe("resolveAppiumBin", () => {
  const envDir = join("/envs", "node20");
  const binDir = join(envDir, "node_modules", ".bin");

  it("returns the extension-less shim on linux and macOS", () => {
    expect(resolveAppiumBin(envDir, "linux")).toBe(join(binDir, "appium"));
    expect(resolveAppiumBin(envDir, "darwin")).toBe(join(binDir, "appium"));
  });

  it("returns the .cmd shim on win32", () => {
    expect(resolveAppiumBin(envDir, "win32")).toBe(join(binDir, "appium.cmd"));
  });
});
