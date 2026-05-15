import { afterEach, expect, it } from "bun:test";
import { realpathSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  detectPackageManager,
  findEnvDir,
  resolveUniqueEnvDir,
} from "./ensureDeps.js";

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tmpDirs.map((d) => rm(d, { recursive: true, force: true })),
  );
  tmpDirs.length = 0;
});

async function makeTmpDir(): Promise<string> {
  const d = realpathSync(
    await mkdtemp(join(tmpdir(), "qawolf-ensuredeps-test-")),
  );
  tmpDirs.push(d);
  return d;
}

// findEnvDir

it("should return the directory containing package.json for a direct file", async () => {
  const root = await makeTmpDir();
  await writeFile(join(root, "package.json"), "{}");
  const flowPath = join(root, "my.flow.ts");
  expect(findEnvDir(flowPath)).toBe(root);
});

it("should walk up to find package.json when flow is nested", async () => {
  const root = await makeTmpDir();
  await writeFile(join(root, "package.json"), "{}");
  const nested = join(root, "flows", "sub");
  await mkdir(nested, { recursive: true });
  const flowPath = join(nested, "my.flow.ts");
  expect(findEnvDir(flowPath)).toBe(root);
});

it("should return undefined when no package.json exists in any ancestor", async () => {
  const root = await makeTmpDir();
  const nested = join(root, "flows");
  await mkdir(nested, { recursive: true });
  const flowPath = join(nested, "my.flow.ts");
  // root has no package.json; walk reaches filesystem root and returns undefined
  expect(findEnvDir(flowPath)).toBeUndefined();
});

// detectPackageManager

it("should detect bun from bun.lockb", async () => {
  const dir = await makeTmpDir();
  await writeFile(join(dir, "bun.lockb"), "");
  expect(detectPackageManager(dir)).toBe("bun");
});

it("should detect pnpm from pnpm-lock.yaml", async () => {
  const dir = await makeTmpDir();
  await writeFile(join(dir, "pnpm-lock.yaml"), "");
  expect(detectPackageManager(dir)).toBe("pnpm");
});

it("should detect yarn from yarn.lock", async () => {
  const dir = await makeTmpDir();
  await writeFile(join(dir, "yarn.lock"), "");
  expect(detectPackageManager(dir)).toBe("yarn");
});

it("should fall back to npm when no lockfile is present", async () => {
  const dir = await makeTmpDir();
  expect(detectPackageManager(dir)).toBe("npm");
});

it("should prefer bun over pnpm and yarn when multiple lockfiles present", async () => {
  const dir = await makeTmpDir();
  await writeFile(join(dir, "bun.lockb"), "");
  await writeFile(join(dir, "pnpm-lock.yaml"), "");
  expect(detectPackageManager(dir)).toBe("bun");
});

it("should detect bun from bun.lock (text format, bun ≥ 1.1)", async () => {
  const dir = await makeTmpDir();
  await writeFile(join(dir, "bun.lock"), "");
  expect(detectPackageManager(dir)).toBe("bun");
});

// resolveUniqueEnvDir

it("should return the envDir when all files resolve to the same package", async () => {
  const root = await makeTmpDir();
  await writeFile(join(root, "package.json"), "{}");
  const nested = join(root, "flows");
  await mkdir(nested, { recursive: true });
  const files = [join(nested, "a.flow.ts"), join(nested, "b.flow.ts")];
  expect(resolveUniqueEnvDir(files)).toBe(root);
});

it("should return undefined when no files have a package.json ancestor", async () => {
  const root = await makeTmpDir();
  const nested = join(root, "flows");
  await mkdir(nested, { recursive: true });
  const files = [join(nested, "a.flow.ts")];
  expect(resolveUniqueEnvDir(files)).toBeUndefined();
});

it("should return undefined for an empty file list", async () => {
  expect(resolveUniqueEnvDir([])).toBeUndefined();
});

it("should throw when files span multiple packages", async () => {
  const rootA = await makeTmpDir();
  const rootB = await makeTmpDir();
  await writeFile(join(rootA, "package.json"), "{}");
  await writeFile(join(rootB, "package.json"), "{}");
  let caughtError: unknown;
  try {
    resolveUniqueEnvDir([join(rootA, "a.flow.ts"), join(rootB, "b.flow.ts")]);
  } catch (e) {
    caughtError = e;
  }
  expect(caughtError).toBeInstanceOf(Error);
  expect((caughtError as Error).message).toContain("2 packages");
});
