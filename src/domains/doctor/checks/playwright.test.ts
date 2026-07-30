import { afterEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";

import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";

import { checkPlaywright } from "./playwright.js";

afterEach(() => {
  mock.restore();
});

function spawnReturning(result: SpawnResult): SpawnFn {
  return mock<SpawnFn>(() => Promise.resolve(result));
}

const envDir = "/fake";
const fakeCli = join(envDir, "node_modules", ".bin", "playwright");

const checkDeps = (spawn: SpawnFn) => ({
  spawn,
  envDir,
  platform: "linux" as NodeJS.Platform,
  checkExists: () => true,
});

describe("checkPlaywright", () => {
  it("spawns the .cmd shim when the platform is win32", async () => {
    const spawn = spawnReturning({
      exitCode: 0,
      stdout: "Version 1.49.1\n",
      stderr: "",
    });
    const r = await checkPlaywright({
      spawn,
      envDir,
      platform: "win32",
      checkExists: () => true,
    });
    expect(r.status).toBe("pass");
    expect(spawn).toHaveBeenCalledWith(
      join(envDir, "node_modules", ".bin", "playwright.cmd"),
      ["--version"],
      { platform: "win32" },
    );
  });

  it("spawns the .exe on win32 when bun wrote no .cmd shim", async () => {
    const spawn = spawnReturning({
      exitCode: 0,
      stdout: "Version 1.49.1\n",
      stderr: "",
    });
    const r = await checkPlaywright({
      spawn,
      envDir,
      platform: "win32",
      checkExists: (path) => path.endsWith(".exe"),
    });
    expect(r.status).toBe("pass");
    expect(spawn).toHaveBeenCalledWith(
      join(envDir, "node_modules", ".bin", "playwright.exe"),
      ["--version"],
      { platform: "win32" },
    );
  });

  it("fails immediately when there is no env dir to resolve from", async () => {
    const spawn = mock<SpawnFn>(() =>
      Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }),
    );
    const r = await checkPlaywright({
      spawn,
      envDir: undefined,
      platform: "linux",
      checkExists: () => true,
    });
    expect(r.status).toBe("fail");
    expect(r.detail).toBe(
      "Playwright is not installed.\n" +
        "Run `qawolf install` to install the runtime dependencies.",
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  it("fails immediately when no candidate shim exists", async () => {
    const spawn = mock<SpawnFn>(() =>
      Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }),
    );
    const r = await checkPlaywright({
      spawn,
      envDir,
      platform: "linux",
      checkExists: () => false,
    });
    expect(r.status).toBe("fail");
    expect(r.detail).toBe(
      `Playwright not found at ${fakeCli}.\n` +
        "Run `qawolf install` to install the runtime dependencies.",
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  it("passes when --version exits 0 with a parseable version and includes version string", async () => {
    const spawn = spawnReturning({
      exitCode: 0,
      stdout: "Version 1.49.1\n",
      stderr: "",
    });
    const r = await checkPlaywright(checkDeps(spawn));
    expect(r).toEqual({
      name: "playwright",
      status: "pass",
      version: "1.49.1",
    });
    expect(spawn).toHaveBeenCalledWith(fakeCli, ["--version"], {
      platform: "linux",
    });
  });

  it("fails when spawn errors (process failed to launch)", async () => {
    const spawn = spawnReturning({ exitCode: -1, stdout: "", stderr: "" });
    const r = await checkPlaywright(checkDeps(spawn));
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("Could not launch");
  });

  it("fails when --version exits non-zero", async () => {
    const spawn = spawnReturning({
      exitCode: 1,
      stdout: "",
      stderr: "boom\n",
    });
    const r = await checkPlaywright(checkDeps(spawn));
    expect(r.status).toBe("fail");
    expect(r.detail).toBe("boom");
  });

  it("fails when output has no version string", async () => {
    const spawn = spawnReturning({ exitCode: 0, stdout: "huh\n", stderr: "" });
    const r = await checkPlaywright(checkDeps(spawn));
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("parse");
  });
});
