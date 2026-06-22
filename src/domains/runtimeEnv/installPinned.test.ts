import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { installPinned } from "./installPinned.js";

const targetDir = "/runtime/env/abc123";
const tempDir = `${targetDir}.installing.${process.pid}`;

function makeSpawnInstall(exitCode: number, stderr = "") {
  return async (_cwd: string) => ({ exitCode, stderr });
}

describe("installPinned", () => {
  it("scaffolds temp dir, installs, and renames to target on success", async () => {
    const fs = makeMemoryFs();

    await installPinned(targetDir, {
      fs,
      spawnInstall: makeSpawnInstall(0),
    });

    // Target dir should exist with a package.json (scaffolded before install)
    expect(fs.existsSync(targetDir)).toBe(true);
    expect(fs.existsSync(join(targetDir, "package.json"))).toBe(true);
    // Temp dir should be gone after successful rename
    expect(fs.existsSync(tempDir)).toBe(false);
  });

  it("cleans up temp dir and throws when install fails", async () => {
    const fs = makeMemoryFs();

    let caughtError: unknown;
    try {
      await installPinned(targetDir, {
        fs,
        spawnInstall: makeSpawnInstall(1, "npm ERR! some failure"),
      });
    } catch (e) {
      caughtError = e;
    }

    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain(targetDir);
    expect((caughtError as Error).message).toContain("npm ERR! some failure");
    // Both temp and target dirs should be absent
    expect(fs.existsSync(tempDir)).toBe(false);
    expect(fs.existsSync(targetDir)).toBe(false);
  });

  it("short-circuits without calling spawnInstall when .bin/playwright exists", async () => {
    const fs = makeMemoryFs();
    // Simulate a previously completed install
    const binDir = join(targetDir, "node_modules", ".bin");
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(join(binDir, "playwright"), "#!/bin/sh");

    let spawnCalled = false;
    await installPinned(targetDir, {
      fs,
      spawnInstall: async (_cwd) => {
        spawnCalled = true;
        return { exitCode: 0, stderr: "" };
      },
    });

    expect(spawnCalled).toBe(false);
  });
});
