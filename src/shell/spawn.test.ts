import { afterEach, describe, expect, it } from "bun:test";

import { buildSpawnCommand } from "./spawn.js";

const originalComSpec = process.env["ComSpec"];

afterEach(() => {
  if (originalComSpec === undefined) delete process.env["ComSpec"];
  else process.env["ComSpec"] = originalComSpec;
});

describe("buildSpawnCommand", () => {
  it("passes the command through untouched on linux/darwin", () => {
    const built = buildSpawnCommand(
      "/usr/local/bin/playwright",
      ["--version"],
      "linux",
      undefined,
    );
    expect(built).toEqual({
      cmd: "/usr/local/bin/playwright",
      args: ["--version"],
      options: {},
    });
  });

  it("does not rewrite a .cmd-suffixed path on linux/darwin", () => {
    const built = buildSpawnCommand("/tmp/weird.cmd", [], "linux", undefined);
    expect(built.cmd).toBe("/tmp/weird.cmd");
  });

  it("routes a win32 .cmd through cmd.exe", () => {
    process.env["ComSpec"] = "C:\\Windows\\System32\\cmd.exe";
    const built = buildSpawnCommand(
      "C:\\proj\\node_modules\\.bin\\playwright.cmd",
      ["--version"],
      "win32",
      undefined,
    );
    expect(built).toEqual({
      cmd: "C:\\Windows\\System32\\cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        '"C:\\proj\\node_modules\\.bin\\playwright.cmd ^^^"--version^^^""',
      ],
      options: { windowsVerbatimArguments: true },
    });
  });

  it("matches the .cmd/.bat suffix case-insensitively on win32", () => {
    expect(buildSpawnCommand("C:\\x.CMD", [], "win32", undefined).args[0]).toBe(
      "/d",
    );
    expect(buildSpawnCommand("C:\\x.Bat", [], "win32", undefined).args[0]).toBe(
      "/d",
    );
  });

  it("spawns .exe and extension-less files directly on win32", () => {
    expect(
      buildSpawnCommand(
        "C:\\Windows\\System32\\cmd.exe",
        [],
        "win32",
        undefined,
      ).cmd,
    ).toBe("C:\\Windows\\System32\\cmd.exe");
    expect(
      buildSpawnCommand(
        "C:\\proj\\node_modules\\.bin\\playwright",
        [],
        "win32",
        undefined,
      ).cmd,
    ).toBe("C:\\proj\\node_modules\\.bin\\playwright");
  });

  it("falls back to cmd.exe when ComSpec is unset", () => {
    delete process.env["ComSpec"];
    expect(buildSpawnCommand("C:\\x.cmd", [], "win32", undefined).cmd).toBe(
      "cmd.exe",
    );
  });

  it("never sets shell", () => {
    expect(
      buildSpawnCommand("C:\\x.cmd", ["a"], "win32", undefined).options.shell,
    ).toBeUndefined();
    expect(
      buildSpawnCommand("/bin/sh", ["a"], "linux", undefined).options.shell,
    ).toBeUndefined();
  });

  it("threads env through on both platforms", () => {
    const env = { FOO: "bar" };
    expect(buildSpawnCommand("/bin/sh", [], "linux", env).options).toEqual({
      env,
    });
    expect(buildSpawnCommand("C:\\x.cmd", [], "win32", env).options).toEqual({
      env,
      windowsVerbatimArguments: true,
    });
  });
});
