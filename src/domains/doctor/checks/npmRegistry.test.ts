import { afterEach, describe, expect, it, mock } from "bun:test";

import type { SpawnFn, SpawnResult } from "~/shell/spawn.js";

import { checkNpmRegistry } from "./npmRegistry.js";

afterEach(() => {
  mock.restore();
});

function spawnReturning(result: SpawnResult): SpawnFn {
  return mock<SpawnFn>(() => Promise.resolve(result));
}

describe("checkNpmRegistry", () => {
  it("passes on exit 0", async () => {
    const spawn = spawnReturning({ exitCode: 0, stdout: "", stderr: "" });
    const r = await checkNpmRegistry({ spawn, platform: "linux" });
    expect(r).toEqual({ name: "npm-registry", status: "pass" });
    expect(spawn).toHaveBeenCalledWith("npm", ["ping"]);
  });

  it("warns on non-zero exit", async () => {
    const spawn = spawnReturning({
      exitCode: 1,
      stdout: "",
      stderr: "registry unreachable\n",
    });
    const r = await checkNpmRegistry({ spawn, platform: "linux" });
    expect(r.status).toBe("warn");
    expect(r.detail).toBe("registry unreachable");
  });

  it("pings via npm.cmd on win32", async () => {
    const spawn = spawnReturning({ exitCode: 0, stdout: "", stderr: "" });
    await checkNpmRegistry({ spawn, platform: "win32" });
    expect(spawn).toHaveBeenCalledWith("npm.cmd", ["ping"]);
  });

  it("warns when npm is missing", async () => {
    const spawn = spawnReturning({ exitCode: -1, stdout: "", stderr: "" });
    const r = await checkNpmRegistry({ spawn, platform: "linux" });
    expect(r.status).toBe("warn");
    expect(r.detail).toContain("not installed");
  });
});
