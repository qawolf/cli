import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { appiumCliCandidates } from "./appiumBins.js";

describe("appiumCliCandidates", () => {
  const envDir = join("/envs", "node20");
  const binDir = join(envDir, "node_modules", ".bin");

  it("returns only the extension-less shim on linux and macOS", () => {
    expect(appiumCliCandidates(envDir, "linux")).toEqual([
      join(binDir, "appium"),
    ]);
    expect(appiumCliCandidates(envDir, "darwin")).toEqual([
      join(binDir, "appium"),
    ]);
  });

  it("lists the npm .cmd then the bun .exe on win32, and nothing else", () => {
    expect(appiumCliCandidates(envDir, "win32")).toEqual([
      join(binDir, "appium.cmd"),
      join(binDir, "appium.exe"),
    ]);
  });
});
