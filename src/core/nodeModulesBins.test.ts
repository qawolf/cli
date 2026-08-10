import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import {
  appiumCliCandidates,
  nodeModulesBinCandidates,
} from "./nodeModulesBins.js";

describe("nodeModulesBinCandidates", () => {
  const envDir = join("/envs", "node20");
  const binDir = join(envDir, "node_modules", ".bin");

  it("returns only the extension-less shim on linux and macOS", () => {
    expect(nodeModulesBinCandidates(envDir, "tsc", "linux")).toEqual([
      join(binDir, "tsc"),
    ]);
    expect(nodeModulesBinCandidates(envDir, "tsc", "darwin")).toEqual([
      join(binDir, "tsc"),
    ]);
  });

  it("lists the npm .cmd then the bun .exe on win32, and nothing else", () => {
    expect(nodeModulesBinCandidates(envDir, "tsc", "win32")).toEqual([
      join(binDir, "tsc.cmd"),
      join(binDir, "tsc.exe"),
    ]);
  });
});

// The wrappers delegate, so these only pin the tool name in both branches.
describe("tool wrappers", () => {
  const envDir = join("/envs", "node20");
  const binDir = join(envDir, "node_modules", ".bin");

  it("names appium", () => {
    expect(appiumCliCandidates(envDir, "linux")).toEqual([
      join(binDir, "appium"),
    ]);
    expect(appiumCliCandidates(envDir, "win32")).toEqual([
      join(binDir, "appium.cmd"),
      join(binDir, "appium.exe"),
    ]);
  });
});
