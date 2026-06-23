import { afterEach, describe, expect, it } from "bun:test";
import { realpathSync } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  readlink,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { linkManagedDeps } from "./linkManagedDeps.js";

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tmpDirs.map((d) => rm(d, { recursive: true, force: true })),
  );
  tmpDirs.length = 0;
});

async function makeTmpDir(): Promise<string> {
  const d = realpathSync(
    await mkdtemp(join(tmpdir(), "qawolf-linkdeps-test-")),
  );
  tmpDirs.push(d);
  return d;
}

type Roots = { bundleRoot: string; depsRoot: string; source: string };

async function makeRoots(): Promise<Roots> {
  const bundleRoot = await makeTmpDir();
  const depsRoot = await makeTmpDir();
  const source = join(depsRoot, "node_modules");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "marker.txt"), "deps");
  return { bundleRoot, depsRoot, source };
}

describe("linkManagedDeps", () => {
  it("creates a fresh symlink to the managed node_modules", async () => {
    const { bundleRoot, depsRoot, source } = await makeRoots();

    await linkManagedDeps(bundleRoot, depsRoot);

    const target = join(bundleRoot, "node_modules");
    expect((await lstat(target)).isSymbolicLink()).toBe(true);
    expect(await readlink(target)).toBe(source);
  });

  it("is idempotent when re-run with the same roots", async () => {
    const { bundleRoot, depsRoot, source } = await makeRoots();

    await linkManagedDeps(bundleRoot, depsRoot);
    await linkManagedDeps(bundleRoot, depsRoot);

    const target = join(bundleRoot, "node_modules");
    expect((await lstat(target)).isSymbolicLink()).toBe(true);
    expect(await readlink(target)).toBe(source);
  });

  it("never clobbers a real node_modules directory", async () => {
    const { bundleRoot, depsRoot } = await makeRoots();
    const target = join(bundleRoot, "node_modules");
    await mkdir(target, { recursive: true });
    await writeFile(join(target, "real.txt"), "user deps");

    await linkManagedDeps(bundleRoot, depsRoot);

    expect((await lstat(target)).isSymbolicLink()).toBe(false);
    expect((await lstat(join(target, "real.txt"))).isFile()).toBe(true);
  });

  it("refreshes a stale symlink to point at the managed deps", async () => {
    const { bundleRoot, depsRoot, source } = await makeRoots();
    const stale = await makeTmpDir();
    const target = join(bundleRoot, "node_modules");
    await symlink(stale, target, "dir");

    await linkManagedDeps(bundleRoot, depsRoot);

    expect(await readlink(target)).toBe(source);
  });

  it("no-ops when bundleRoot equals depsRoot", async () => {
    const { depsRoot } = await makeRoots();
    const target = join(depsRoot, "node_modules");

    await linkManagedDeps(depsRoot, depsRoot);

    // The pre-existing real node_modules is untouched (not turned into a symlink).
    expect((await lstat(target)).isSymbolicLink()).toBe(false);
  });
});
