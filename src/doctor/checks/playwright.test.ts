import { afterEach, describe, expect, it, mock } from "bun:test";

import type { SpawnFn, SpawnResult } from "~/doctor/types.js";

import { checkPlaywright } from "./playwright.js";

afterEach(() => {
  mock.restore();
});

function spawnReturning(result: SpawnResult): SpawnFn {
  return mock<SpawnFn>(() => Promise.resolve(result));
}

const FAKE_NODE = "/fake/node";
const FAKE_CLI = "/fake/playwright/cli.js";

const checkDeps = (spawn: SpawnFn) => ({
  spawn,
  execPath: FAKE_NODE,
  playwrightCliPath: FAKE_CLI,
});

describe("checkPlaywright", () => {
  it("passes when --version exits 0 with a parseable version", async () => {
    const spawn = spawnReturning({
      exitCode: 0,
      stdout: "Version 1.49.1\n",
      stderr: "",
    });
    const r = await checkPlaywright(checkDeps(spawn));
    expect(r).toEqual({ name: "playwright", status: "pass" });
    expect(spawn).toHaveBeenCalledWith(FAKE_NODE, [FAKE_CLI, "--version"]);
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
