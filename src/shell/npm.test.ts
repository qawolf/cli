import { describe, expect, it } from "bun:test";

import { resolveNpmCommand } from "./npm.js";
import { buildSpawnCommand } from "./spawn.js";

describe("resolveNpmCommand", () => {
  it("returns npm.cmd on win32", () => {
    expect(resolveNpmCommand("win32")).toBe("npm.cmd");
  });

  it("returns npm on linux and darwin", () => {
    expect(resolveNpmCommand("linux")).toBe("npm");
    expect(resolveNpmCommand("darwin")).toBe("npm");
  });

  // Naming npm.cmd without routing through cmd.exe trades ENOENT for EINVAL
  // (CVE-2024-27980), so the two must stay paired.
  it("resolves to a command buildSpawnCommand sends through cmd.exe", () => {
    const built = buildSpawnCommand(
      resolveNpmCommand("win32"),
      [],
      "win32",
      undefined,
    );
    expect(built.args.slice(0, 3)).toEqual(["/d", "/s", "/c"]);
  });

  it("resolves to a command spawned directly on posix", () => {
    const built = buildSpawnCommand(
      resolveNpmCommand("linux"),
      [],
      "linux",
      undefined,
    );
    expect(built.cmd).toBe("npm");
    expect(built.options.shell).toBeUndefined();
  });
});
