import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { makeDefaultFs } from "~/shell/fs.js";
import { makeMemoryFs } from "~/shell/fs.testUtils.js";

import { findEnvDir, resolveUniqueEnvDir } from "./ensureDeps.js";
import { makeTmpDirTracker } from "~/shell/tmpDir.testUtils.js";

const defaultFs = makeDefaultFs();

const tracker = makeTmpDirTracker("qawolf-ensuredeps-test-");

afterEach(() => tracker.cleanup());

describe("findEnvDir", () => {
  it("should return the directory containing package.json for a direct file", async () => {
    const root = await tracker.makeTmpDir();
    await writeFile(join(root, "package.json"), "{}");
    const flowPath = join(root, "my.flow.ts");
    expect(findEnvDir(flowPath, defaultFs)).toBe(root);
  });

  it("should walk up to find package.json when flow is nested", async () => {
    const root = await tracker.makeTmpDir();
    await writeFile(join(root, "package.json"), "{}");
    const nested = join(root, "flows", "sub");
    await mkdir(nested, { recursive: true });
    const flowPath = join(nested, "my.flow.ts");
    expect(findEnvDir(flowPath, defaultFs)).toBe(root);
  });

  it("should return undefined when no package.json exists in any ancestor", async () => {
    const root = await tracker.makeTmpDir();
    const nested = join(root, "flows");
    await mkdir(nested, { recursive: true });
    const flowPath = join(nested, "my.flow.ts");
    // root has no package.json; walk reaches filesystem root and returns undefined
    expect(findEnvDir(flowPath, defaultFs)).toBeUndefined();
  });
});

describe("findEnvDir with injected fs", () => {
  it("should find package.json via injected memFs", async () => {
    const memFs = makeMemoryFs();
    await memFs.mkdir("/pkg");
    await memFs.writeFile("/pkg/package.json", "{}");
    const result = findEnvDir("/pkg/my.flow.ts", memFs);
    expect(result).toBe("/pkg");
  });
});

describe("resolveUniqueEnvDir", () => {
  it("should return the envDir when all files resolve to the same package", async () => {
    const root = await tracker.makeTmpDir();
    await writeFile(join(root, "package.json"), "{}");
    const nested = join(root, "flows");
    await mkdir(nested, { recursive: true });
    const files = [join(nested, "a.flow.ts"), join(nested, "b.flow.ts")];
    expect(resolveUniqueEnvDir(files, defaultFs)).toBe(root);
  });

  it("should return undefined when no files have a package.json ancestor", async () => {
    const root = await tracker.makeTmpDir();
    const nested = join(root, "flows");
    await mkdir(nested, { recursive: true });
    const files = [join(nested, "a.flow.ts")];
    expect(resolveUniqueEnvDir(files, defaultFs)).toBeUndefined();
  });

  it("should return undefined for an empty file list", async () => {
    expect(resolveUniqueEnvDir([], defaultFs)).toBeUndefined();
  });

  it("should throw when files span multiple packages", async () => {
    const rootA = await tracker.makeTmpDir();
    const rootB = await tracker.makeTmpDir();
    await writeFile(join(rootA, "package.json"), "{}");
    await writeFile(join(rootB, "package.json"), "{}");
    let caughtError: unknown;
    try {
      resolveUniqueEnvDir(
        [join(rootA, "a.flow.ts"), join(rootB, "b.flow.ts")],
        defaultFs,
      );
    } catch (e) {
      caughtError = e;
    }
    expect(caughtError).toBeInstanceOf(Error);
    expect((caughtError as Error).message).toContain("2 packages");
  });
});
