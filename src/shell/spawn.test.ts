import { describe, expect, it } from "bun:test";

import { buildSpawnOptions } from "./spawn.js";

describe("buildSpawnOptions", () => {
  it("returns an empty options object on linux/darwin", () => {
    expect(
      buildSpawnOptions("/usr/local/bin/playwright", "linux", undefined),
    ).toEqual({});
    expect(
      buildSpawnOptions("/usr/local/bin/playwright", "darwin", undefined),
    ).toEqual({});
  });

  it("does not set shell on linux/darwin even for a .cmd-suffixed path", () => {
    const opts = buildSpawnOptions("/tmp/weird.cmd", "linux", undefined);
    expect(opts.shell).toBeUndefined();
  });

  it("sets shell:true on win32 for a .cmd file", () => {
    const opts = buildSpawnOptions(
      "C:\\proj\\node_modules\\.bin\\playwright.cmd",
      "win32",
      undefined,
    );
    expect(opts.shell).toBe(true);
  });

  it("sets shell:true on win32 for a .bat file", () => {
    const opts = buildSpawnOptions("C:\\tool.bat", "win32", undefined);
    expect(opts.shell).toBe(true);
  });

  it("sets shell:true on win32 case-insensitively", () => {
    expect(buildSpawnOptions("C:\\x.CMD", "win32", undefined).shell).toBe(true);
    expect(buildSpawnOptions("C:\\x.Bat", "win32", undefined).shell).toBe(true);
  });

  it("does not set shell on win32 for .exe or extension-less files", () => {
    expect(
      buildSpawnOptions("C:\\Windows\\System32\\cmd.exe", "win32", undefined)
        .shell,
    ).toBeUndefined();
    expect(
      buildSpawnOptions(
        "C:\\proj\\node_modules\\.bin\\playwright",
        "win32",
        undefined,
      ).shell,
    ).toBeUndefined();
  });

  it("threads env through unchanged", () => {
    const env = { FOO: "bar" };
    expect(buildSpawnOptions("/bin/sh", "linux", env)).toEqual({ env });
    expect(buildSpawnOptions("C:\\x.cmd", "win32", env)).toEqual({
      env,
      shell: true,
    });
  });
});
