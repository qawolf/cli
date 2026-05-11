import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  createTempPathRegistry,
  mintTempPath,
  removeTempDir,
} from "./safeRemove.js";

let workDir = "";
let registry = createTempPathRegistry();

beforeEach(async () => {
  workDir = await mkdtemp(join(tmpdir(), "qawolf-saferm-"));
  registry = createTempPathRegistry();
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

describe("mintTempPath", () => {
  it("returns an absolute path matching .pull-<16hex>", () => {
    const dest = join(workDir, "envA");
    const minted = mintTempPath(dest, "pull", registry);
    expect(minted).toMatch(/\.pull-[a-f0-9]{16}$/);
    expect(minted.startsWith(dest)).toBe(true);
  });

  it("returns a different path on each call", () => {
    const dest = join(workDir, "envA");
    expect(mintTempPath(dest, "pull", registry)).not.toBe(
      mintTempPath(dest, "pull", registry),
    );
  });

  it("supports the 'old' kind for atomic-swap rollback", () => {
    const minted = mintTempPath(join(workDir, "envA"), "old", registry);
    expect(minted).toMatch(/\.old-[a-f0-9]{16}$/);
  });
});

describe("removeTempDir", () => {
  it("removes a freshly minted directory that exists", async () => {
    const dir = mintTempPath(join(workDir, "envA"), "pull", registry);
    await mkdir(dir, { recursive: true });
    await mkdir(join(dir, "nested"));
    await Bun.write(join(dir, "file.txt"), "hi");

    await removeTempDir(dir, registry);

    expect(await exists(dir)).toBe(false);
  });

  it("is a no-op for a minted path that does not exist on disk", async () => {
    const dir = mintTempPath(join(workDir, "envA"), "pull", registry);
    await removeTempDir(dir, registry);
    expect(await exists(dir)).toBe(false);
  });

  it("rejects empty paths", async () => {
    expect(removeTempDir("", registry)).rejects.toThrow();
  });

  it("rejects relative paths", async () => {
    expect(
      removeTempDir("./relative.pull-aaaaaaaaaaaaaaaa", registry),
    ).rejects.toThrow();
  });

  it("rejects the filesystem root", async () => {
    expect(removeTempDir(sep, registry)).rejects.toThrow();
  });

  it("rejects the user's home directory", async () => {
    expect(removeTempDir(homedir(), registry)).rejects.toThrow();
  });

  it("rejects the current working directory", async () => {
    expect(removeTempDir(process.cwd(), registry)).rejects.toThrow();
  });

  it("rejects paths that don't match the .pull-<hex>/.old-<hex> sentinel", async () => {
    const dir = join(workDir, "no-sentinel");
    await mkdir(dir);
    expect(removeTempDir(dir, registry)).rejects.toThrow();
    expect(await exists(dir)).toBe(true);
  });

  it("rejects paths that match the sentinel but were never minted (capability check)", async () => {
    const forged = join(workDir, "forged.pull-1234567890abcdef");
    await mkdir(forged);
    expect(removeTempDir(forged, registry)).rejects.toThrow();
    expect(await exists(forged)).toBe(true);
  });

  it("rejects paths minted in a different registry", async () => {
    const otherRegistry = createTempPathRegistry();
    const dir = mintTempPath(join(workDir, "envA"), "pull", otherRegistry);
    await mkdir(dir, { recursive: true });
    expect(removeTempDir(dir, registry)).rejects.toThrow();
    expect(await exists(dir)).toBe(true);
  });
});
