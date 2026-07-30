import { describe, expect, it } from "bun:test";

import { resolveNpmCommand } from "./npm.js";
import { buildSpawnOptions } from "./spawn.js";

describe("resolveNpmCommand", () => {
  it("returns npm.cmd on win32", () => {
    expect(resolveNpmCommand("win32")).toBe("npm.cmd");
  });

  it("returns npm on linux and darwin", () => {
    expect(resolveNpmCommand("linux")).toBe("npm");
    expect(resolveNpmCommand("darwin")).toBe("npm");
  });

  // Naming npm.cmd without shell:true trades ENOENT for EINVAL
  // (CVE-2024-27980), so the two must stay paired.
  it("resolves to a command buildSpawnOptions gives a shell on win32", () => {
    const opts = buildSpawnOptions(
      resolveNpmCommand("win32"),
      "win32",
      undefined,
    );
    expect(opts.shell).toBe(true);
  });

  it("resolves to a command that gets no shell on posix", () => {
    const opts = buildSpawnOptions(
      resolveNpmCommand("linux"),
      "linux",
      undefined,
    );
    expect(opts.shell).toBeUndefined();
  });
});
