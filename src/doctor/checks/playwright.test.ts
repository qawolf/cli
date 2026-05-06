import { afterEach, describe, expect, it, mock } from "bun:test";

import type { SpawnFn, SpawnResult } from "~/doctor/types.js";

import { checkPlaywright } from "./playwright.js";

afterEach(() => {
  mock.restore();
});

function spawnReturning(result: SpawnResult): SpawnFn {
  return mock<SpawnFn>(() => Promise.resolve(result));
}

describe("checkPlaywright", () => {
  it("passes when --version exits 0 with a parseable version", async () => {
    const spawn = spawnReturning({
      exitCode: 0,
      stdout: "Version 1.49.1\n",
      stderr: "",
    });
    const r = await checkPlaywright({ spawn });
    expect(r).toEqual({ name: "playwright", status: "pass" });
    expect(spawn).toHaveBeenCalledWith("playwright", ["--version"]);
  });

  it("fails when spawn errors (binary missing)", async () => {
    const spawn = spawnReturning({ exitCode: -1, stdout: "", stderr: "" });
    const r = await checkPlaywright({ spawn });
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("not installed");
  });

  it("fails when --version exits non-zero", async () => {
    const spawn = spawnReturning({
      exitCode: 1,
      stdout: "",
      stderr: "boom\n",
    });
    const r = await checkPlaywright({ spawn });
    expect(r.status).toBe("fail");
    expect(r.detail).toBe("boom");
  });

  it("fails when output has no version string", async () => {
    const spawn = spawnReturning({ exitCode: 0, stdout: "huh\n", stderr: "" });
    const r = await checkPlaywright({ spawn });
    expect(r.status).toBe("fail");
    expect(r.detail).toContain("parse");
  });
});
