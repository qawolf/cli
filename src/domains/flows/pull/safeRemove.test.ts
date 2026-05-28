import { homedir } from "node:os";
import { join, sep } from "node:path";
import { beforeEach, describe, expect, it } from "bun:test";

import { makeMemoryFs } from "~/shell/fs.testUtils.js";
import {
  createTempPathRegistry,
  mintTempPath,
  removeTempDir,
} from "./safeRemove.js";

let registry = createTempPathRegistry();

beforeEach(() => {
  registry = createTempPathRegistry();
});

describe("mintTempPath", () => {
  it("returns an absolute path matching .pull-<16hex>", () => {
    const dest = "/tmp/qawolf-test/envA";
    const minted = mintTempPath(dest, "pull", registry);
    expect(minted).toMatch(/\.pull-[a-f0-9]{16}$/);
    expect(minted.startsWith(dest)).toBe(true);
  });

  it("returns a different path on each call", () => {
    const dest = "/tmp/qawolf-test/envA";
    expect(mintTempPath(dest, "pull", registry)).not.toBe(
      mintTempPath(dest, "pull", registry),
    );
  });

  it("supports the 'old' kind for atomic-swap rollback", () => {
    const minted = mintTempPath("/tmp/qawolf-test/envA", "old", registry);
    expect(minted).toMatch(/\.old-[a-f0-9]{16}$/);
  });

  it("rejects a relative destAbs at mint time", () => {
    expect(() => mintTempPath("relative/path", "pull", registry)).toThrow(
      /not absolute/i,
    );
  });
});

describe("removeTempDir", () => {
  it("removes a freshly minted directory that exists", async () => {
    const memFs = makeMemoryFs();
    const dir = mintTempPath("/tmp/qawolf-test/envA", "pull", registry);
    await memFs.mkdir(dir, { recursive: true });
    await memFs.mkdir(join(dir, "nested"));
    await memFs.writeFile(join(dir, "file.txt"), "hi");

    await removeTempDir(dir, registry, memFs);

    expect(await memFs.pathExists(dir)).toBe(false);
  });

  it("is a no-op for a minted path that does not exist on disk", async () => {
    const memFs = makeMemoryFs();
    const dir = mintTempPath("/tmp/qawolf-test/envA", "pull", registry);
    await removeTempDir(dir, registry, memFs);
    expect(await memFs.pathExists(dir)).toBe(false);
  });

  it("rejects empty paths", async () => {
    expect(removeTempDir("", registry)).rejects.toThrow();
  });

  it("rejects relative paths", async () => {
    expect(
      removeTempDir("./relative.pull-aaaaaaaaaaaaaaaa", registry),
    ).rejects.toThrow();
  });

  it("rejects the filesystem root (no sentinel)", async () => {
    expect(removeTempDir(sep, registry)).rejects.toThrow();
  });

  it("rejects the user's home directory (no sentinel)", async () => {
    expect(removeTempDir(homedir(), registry)).rejects.toThrow();
  });

  it("rejects the current working directory (no sentinel)", async () => {
    expect(removeTempDir(process.cwd(), registry)).rejects.toThrow();
  });

  it("rejects paths that don't match the .pull-<hex>/.old-<hex> sentinel", async () => {
    expect(
      removeTempDir("/tmp/qawolf-test/no-sentinel", registry),
    ).rejects.toThrow();
  });

  it("rejects paths that match the sentinel but were never minted (capability check)", async () => {
    expect(
      removeTempDir("/tmp/qawolf-test/forged.pull-1234567890abcdef", registry),
    ).rejects.toThrow();
  });

  it("rejects paths minted in a different registry", async () => {
    const otherRegistry = createTempPathRegistry();
    const dir = mintTempPath("/tmp/qawolf-test/envA", "pull", otherRegistry);
    expect(removeTempDir(dir, registry)).rejects.toThrow();
  });
});
