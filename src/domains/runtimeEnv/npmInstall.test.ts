import { describe, expect, it } from "bun:test";

import { buildNpmInstallSpawn } from "./npmInstall.js";

describe("buildNpmInstallSpawn", () => {
  it("spawns npm.cmd through a shell on win32", () => {
    const { cmd, args, options } = buildNpmInstallSpawn(
      "C:\\proj\\env",
      "win32",
    );
    expect(cmd).toBe("npm.cmd");
    expect(args).toEqual(["install", "--legacy-peer-deps"]);
    expect(options.shell).toBe(true);
    expect(options.cwd).toBe("C:\\proj\\env");
  });

  it("spawns bare npm without a shell on posix", () => {
    const { cmd, options } = buildNpmInstallSpawn("/tmp/env", "linux");
    expect(cmd).toBe("npm");
    expect(options.shell).toBeUndefined();
    expect(options.cwd).toBe("/tmp/env");
  });
});
