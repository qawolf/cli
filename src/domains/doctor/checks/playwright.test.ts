import { afterEach, describe, expect, it, mock } from "bun:test";
import { join } from "node:path";

import { playwrightVersion } from "~/generated/dependencyVersions.js";
import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";

import { checkPlaywright } from "./playwright.js";

afterEach(() => {
  mock.restore();
});

function spawnReturning(result: SpawnResult): SpawnFn {
  return mock<SpawnFn>(() => Promise.resolve(result));
}

const envDir = "/fake";
const execPath = "/fake/bin/node";
const fakeCliJs = join(envDir, "node_modules", "playwright", "cli.js");

const checkDeps = (spawn: SpawnFn) => ({
  spawn,
  execPath,
  envDir,
  platform: "linux" as NodeJS.Platform,
  checkExists: () => true,
});

const versionOutput = (version: string): SpawnResult => ({
  exitCode: 0,
  stdout: `Version ${version}\n`,
  stderr: "",
});

describe("checkPlaywright", () => {
  it("runs the playwright package's cli.js through execPath, not a .bin shim", async () => {
    const spawn = spawnReturning(versionOutput(playwrightVersion));
    const r = await checkPlaywright(checkDeps(spawn));
    expect(r.status).toBe("pass");
    expect(spawn).toHaveBeenCalledWith(execPath, [fakeCliJs, "--version"], {
      platform: "linux",
      env: { BUN_BE_BUN: "1" },
    });
  });

  it("uses the same cli.js path on win32 (no .cmd/.exe shim games)", async () => {
    const spawn = spawnReturning(versionOutput(playwrightVersion));
    const r = await checkPlaywright({
      spawn,
      execPath,
      envDir,
      platform: "win32",
      checkExists: (path) => path === fakeCliJs,
    });
    expect(r.status).toBe("pass");
    expect(spawn).toHaveBeenCalledWith(execPath, [fakeCliJs, "--version"], {
      platform: "win32",
      env: { BUN_BE_BUN: "1" },
    });
  });

  it("fails immediately when there is no env dir to resolve from", async () => {
    const spawn = spawnReturning(versionOutput(playwrightVersion));
    const r = await checkPlaywright({
      spawn,
      execPath,
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

  it("fails immediately when cli.js does not exist", async () => {
    const spawn = spawnReturning(versionOutput(playwrightVersion));
    const r = await checkPlaywright({
      spawn,
      execPath,
      envDir,
      platform: "linux",
      checkExists: () => false,
    });
    expect(r.status).toBe("fail");
    expect(r.detail).toBe(
      `Playwright not found at ${fakeCliJs}.\n` +
        "Run `qawolf install` to install the runtime dependencies.",
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  it("passes when the reported version matches the pinned runtime version", async () => {
    const spawn = spawnReturning(versionOutput(playwrightVersion));
    const r = await checkPlaywright(checkDeps(spawn));
    expect(r).toEqual({
      name: "playwright",
      status: "pass",
      version: playwrightVersion,
    });
  });

  // The state the client report hit: doctor said "pass" while the installed
  // playwright could not launch the browser build the runtime needs.
  it("fails when the reported version differs from the pinned runtime version", async () => {
    const spawn = spawnReturning(versionOutput("1.49.1"));
    const r = await checkPlaywright(checkDeps(spawn));
    expect(r.status).toBe("fail");
    expect(r.version).toBe("1.49.1");
    expect(r.detail).toBe(
      `Playwright 1.49.1 is installed but the flow runtime requires ${playwrightVersion}; local runs will fail to launch browsers. Run \`qawolf install\` to repair the runtime dependencies.`,
    );
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
