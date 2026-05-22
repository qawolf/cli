import { afterEach, describe, expect, it, mock } from "bun:test";

import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";

import { checkPlaywright } from "./playwright.js";

afterEach(() => {
  mock.restore();
});

function spawnReturning(result: SpawnResult): SpawnFn {
  return mock<SpawnFn>(() => Promise.resolve(result));
}

const fakeCli = "/fake/node_modules/.bin/playwright";

const checkDeps = (spawn: SpawnFn) => ({
  spawn,
  playwrightCliPath: fakeCli,
});

describe("checkPlaywright", () => {
  it("fails immediately when playwrightCliPath is null (resolution failure)", async () => {
    const spawn = mock<SpawnFn>(() =>
      Promise.resolve({ exitCode: 0, stdout: "", stderr: "" }),
    );
    const r = await checkPlaywright({
      spawn,
      playwrightCliPath: undefined,
    });
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("Could not find");
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
    expect(spawn).toHaveBeenCalledWith(fakeCli, ["--version"]);
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
