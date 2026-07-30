import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it } from "bun:test";

import {
  buildNpmInstallSpawn,
  type NpmSpawnFn,
  spawnNpmInstall,
} from "./npmInstall.js";

const originalComSpec = process.env["ComSpec"];

afterEach(() => {
  if (originalComSpec === undefined) delete process.env["ComSpec"];
  else process.env["ComSpec"] = originalComSpec;
});

describe("buildNpmInstallSpawn", () => {
  it("routes npm.cmd through cmd.exe on win32 and keeps cwd", () => {
    process.env["ComSpec"] = "C:\\Windows\\System32\\cmd.exe";
    const { cmd, args, options } = buildNpmInstallSpawn(
      "C:\\proj\\env",
      "win32",
    );
    expect(cmd).toBe("C:\\Windows\\System32\\cmd.exe");
    expect(args).toEqual([
      "/d",
      "/s",
      "/c",
      '"npm.cmd ^^^"install^^^" ^^^"--legacy-peer-deps^^^""',
    ]);
    expect(options.windowsVerbatimArguments).toBe(true);
    expect(options.shell).toBeUndefined();
    expect(options.cwd).toBe("C:\\proj\\env");
  });

  it("spawns bare npm without a shell on posix", () => {
    const { cmd, args, options } = buildNpmInstallSpawn("/tmp/env", "linux");
    expect(cmd).toBe("npm");
    expect(args).toEqual(["install", "--legacy-peer-deps"]);
    expect(options.shell).toBeUndefined();
    expect(options.cwd).toBe("/tmp/env");
  });
});

function fakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: { resume: () => void };
    stderr: EventEmitter;
  };
  child.stdout = { resume: () => {} };
  child.stderr = new EventEmitter();
  return child;
}

describe("spawnNpmInstall", () => {
  // Guards the wiring, not just the plan: dropping the options argument would
  // restore the Windows failure while buildNpmInstallSpawn's tests still pass.
  it("forwards the built command, args, and options to spawn", async () => {
    const calls: { cmd: string; args: string[]; options: object }[] = [];
    const child = fakeChild();
    const spawn = ((cmd: string, args: string[], options: object) => {
      calls.push({ cmd, args, options });
      return child;
    }) as unknown as NpmSpawnFn;

    const promise = spawnNpmInstall("/tmp/env", spawn);
    child.emit("close", 0);
    const result = await promise;

    expect(result.exitCode).toBe(0);
    // spawnNpmInstall builds for process.platform: bare npm on posix, npm.cmd
    // routed through cmd.exe on win32. cwd forwards unchanged on both.
    if (process.platform === "win32") {
      expect(calls[0]?.cmd).toBe(process.env["ComSpec"] ?? "cmd.exe");
      expect(calls[0]?.args).toEqual([
        "/d",
        "/s",
        "/c",
        '"npm.cmd ^^^"install^^^" ^^^"--legacy-peer-deps^^^""',
      ]);
    } else {
      expect(calls[0]?.cmd).toBe("npm");
      expect(calls[0]?.args).toEqual(["install", "--legacy-peer-deps"]);
    }
    expect(calls[0]?.options).toMatchObject({ cwd: "/tmp/env" });
  });
});
