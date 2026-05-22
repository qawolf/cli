import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { resolvePlaywrightCli } from "./playwright.js";

describe("resolvePlaywrightCli", () => {
  let envDir: string;
  let binDir: string;

  beforeEach(async () => {
    envDir = await mkdtemp(join(tmpdir(), "qawolf-playwright-"));
    binDir = join(envDir, "node_modules", ".bin");
    await mkdir(binDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(envDir, { recursive: true, force: true });
  });

  it("returns the extension-less binary on linux/macOS", async () => {
    await writeFile(join(binDir, "playwright"), "#!/bin/sh\n");
    await writeFile(join(binDir, "playwright.cmd"), "@echo off\n");
    expect(resolvePlaywrightCli(envDir, "linux")).toBe(
      join(binDir, "playwright"),
    );
    expect(resolvePlaywrightCli(envDir, "darwin")).toBe(
      join(binDir, "playwright"),
    );
  });

  it("prefers playwright.cmd on win32 even when the extension-less script exists", async () => {
    await writeFile(join(binDir, "playwright"), "#!/bin/sh\n");
    await writeFile(join(binDir, "playwright.cmd"), "@echo off\n");
    expect(resolvePlaywrightCli(envDir, "win32")).toBe(
      join(binDir, "playwright.cmd"),
    );
  });

  it("falls back to the extension-less script on win32 when .cmd is missing", async () => {
    await writeFile(join(binDir, "playwright"), "#!/bin/sh\n");
    expect(resolvePlaywrightCli(envDir, "win32")).toBe(
      join(binDir, "playwright"),
    );
  });

  it("throws when no candidate exists", () => {
    expect(() => resolvePlaywrightCli(envDir, "linux")).toThrow(
      "Could not find Playwright",
    );
    expect(() => resolvePlaywrightCli(envDir, "win32")).toThrow(
      "Could not find Playwright",
    );
  });
});
