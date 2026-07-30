import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { playwrightCliCandidates } from "./playwrightBins.js";

describe("playwrightCliCandidates", () => {
  const envDir = "/proj";
  const binDir = join(envDir, "node_modules", ".bin");

  it("returns only the extension-less shim on linux and macOS", () => {
    expect(playwrightCliCandidates(envDir, "linux")).toEqual([
      join(binDir, "playwright"),
    ]);
    expect(playwrightCliCandidates(envDir, "darwin")).toEqual([
      join(binDir, "playwright"),
    ]);
  });

  it("includes the bun-written .exe on win32, after the npm .cmd shim", () => {
    expect(playwrightCliCandidates(envDir, "win32")).toEqual([
      join(binDir, "playwright.cmd"),
      join(binDir, "playwright.exe"),
      join(binDir, "playwright"),
    ]);
  });
});
