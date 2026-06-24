import { afterEach, describe, expect, it } from "bun:test";
import { realpathSync } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  readlink,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { pinnedPackages } from "./pinnedPackages.js";
import { prepareRunDir } from "./prepareRunDir.js";

const tmpDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tmpDirs.map((d) => rm(d, { recursive: true, force: true })),
  );
  tmpDirs.length = 0;
});

async function makeTmpDir(): Promise<string> {
  const d = realpathSync(await mkdtemp(join(tmpdir(), "qawolf-rundir-test-")));
  tmpDirs.push(d);
  return d;
}

async function makeDepsRoot(): Promise<string> {
  const depsRoot = await makeTmpDir();
  const nm = join(depsRoot, "node_modules");
  await mkdir(nm, { recursive: true });
  for (const { name } of pinnedPackages) {
    const pkgDir = join(nm, ...name.split("/"));
    await mkdir(pkgDir, { recursive: true });
    await writeFile(
      join(pkgDir, "package.json"),
      JSON.stringify({ name, version: "0.0.0" }),
    );
  }
  return depsRoot;
}

describe("prepareRunDir", () => {
  describe("inner-hop symlink", () => {
    it("builds exec/node_modules as a real dir with per-pinned-package symlinks", async () => {
      const runRoot = await makeTmpDir();
      const depsRoot = await makeDepsRoot();
      const flowFile = join(runRoot, "flow.ts");
      await writeFile(flowFile, "// flow");

      const result = await prepareRunDir({
        files: [flowFile],
        projectDir: undefined,
        depsRoot,
        runRoot,
      });
      tmpDirs.push(result.runDir);

      const innerHop = join(result.runDir, "exec", "node_modules");
      expect((await lstat(innerHop)).isDirectory()).toBe(true);
      expect(await readlink(join(innerHop, "@qawolf", "flows"))).toBe(
        join(depsRoot, "node_modules", "@qawolf", "flows"),
      );
    });
  });

  describe("outer-hop population", () => {
    it("symlinks runDir/node_modules to the nearest ancestor node_modules when projectDir is given", async () => {
      const runRoot = await makeTmpDir();
      const depsRoot = await makeDepsRoot();
      const projectDir = await makeTmpDir();
      const projectNm = join(projectDir, "node_modules");
      await mkdir(projectNm, { recursive: true });
      const flowFile = join(projectDir, "flow.ts");
      await writeFile(flowFile, "// flow");

      const result = await prepareRunDir({
        files: [flowFile],
        projectDir,
        depsRoot,
        runRoot,
      });
      tmpDirs.push(result.runDir);

      const outerHop = join(result.runDir, "node_modules");
      expect((await lstat(outerHop)).isSymbolicLink()).toBe(true);
      expect(await readlink(outerHop)).toBe(projectNm);
    });

    it("leaves outer hop absent when no projectDir or no installable deps", async () => {
      const runRoot = await makeTmpDir();
      const depsRoot = await makeDepsRoot();

      // Case 1: no projectDir
      await writeFile(join(runRoot, "flow.ts"), "// flow");
      const result1 = await prepareRunDir({
        files: [join(runRoot, "flow.ts")],
        projectDir: undefined,
        depsRoot,
        runRoot,
      });
      tmpDirs.push(result1.runDir);
      expect(lstat(join(result1.runDir, "node_modules"))).rejects.toThrow();

      // Case 2: projectDir with no node_modules and no package.json deps
      const projectDir = await makeTmpDir();
      await writeFile(join(projectDir, "flow.ts"), "// flow");
      const result2 = await prepareRunDir({
        files: [join(projectDir, "flow.ts")],
        projectDir,
        depsRoot,
        runRoot,
      });
      tmpDirs.push(result2.runDir);
      expect(lstat(join(result2.runDir, "node_modules"))).rejects.toThrow();
    });
  });

  describe("exec staging", () => {
    it("copies individual flow files into exec/ when no projectDir", async () => {
      const runRoot = await makeTmpDir();
      const depsRoot = await makeDepsRoot();
      const flowFile = join(runRoot, "myFlow.ts");
      await writeFile(flowFile, "// my flow");

      const result = await prepareRunDir({
        files: [flowFile],
        projectDir: undefined,
        depsRoot,
        runRoot,
      });
      tmpDirs.push(result.runDir);

      const stagedFlow = join(result.runDir, "exec", "myFlow.ts");
      expect((await lstat(stagedFlow)).isFile()).toBe(true);
      expect(result.files).toEqual([stagedFlow]);
    });

    it("copies entire projectDir into exec/ and remaps flow paths", async () => {
      const runRoot = await makeTmpDir();
      const depsRoot = await makeDepsRoot();
      const projectDir = await makeTmpDir();
      await writeFile(join(projectDir, "helper.ts"), "// helper");
      const flowFile = join(projectDir, "myFlow.ts");
      await writeFile(flowFile, "// flow");

      const result = await prepareRunDir({
        files: [flowFile],
        projectDir,
        depsRoot,
        runRoot,
      });
      tmpDirs.push(result.runDir);

      const execDir = join(result.runDir, "exec");
      expect((await lstat(join(execDir, "helper.ts"))).isFile()).toBe(true);
      expect((await lstat(join(execDir, "myFlow.ts"))).isFile()).toBe(true);
      expect(result.files).toEqual([join(execDir, "myFlow.ts")]);
    });

    it("excludes node_modules from the projectDir copy", async () => {
      const runRoot = await makeTmpDir();
      const depsRoot = await makeDepsRoot();
      const projectDir = await makeTmpDir();
      const projectNm = join(projectDir, "node_modules");
      await mkdir(projectNm, { recursive: true });
      const flowFile = join(projectDir, "flow.ts");
      await writeFile(flowFile, "// flow");

      const result = await prepareRunDir({
        files: [flowFile],
        projectDir,
        depsRoot,
        runRoot,
      });
      tmpDirs.push(result.runDir);

      // exec/node_modules is the inner hop — a real dir, not a copy of project nm
      const execNm = join(result.runDir, "exec", "node_modules");
      expect((await lstat(execNm)).isDirectory()).toBe(true);
      expect(await readlink(join(execNm, "@qawolf", "flows"))).toBe(
        join(depsRoot, "node_modules", "@qawolf", "flows"),
      );
    });
  });

  describe("cleanup", () => {
    it("removes the runDir on cleanup()", async () => {
      const runRoot = await makeTmpDir();
      const depsRoot = await makeDepsRoot();
      const flowFile = join(runRoot, "flow.ts");
      await writeFile(flowFile, "// flow");

      const result = await prepareRunDir({
        files: [flowFile],
        projectDir: undefined,
        depsRoot,
        runRoot,
      });

      await result.cleanup();

      expect(lstat(result.runDir)).rejects.toThrow();
    });
  });

  describe("prefer-pinned invariant", () => {
    it("executor (inner hop) wins over project copy (outer hop) by path walk-up order", async () => {
      const runRoot = await makeTmpDir();
      const depsRoot = await makeDepsRoot();

      // Outer hop: projectDir/node_modules has a project copy of @qawolf/flows
      const projectDir = await makeTmpDir();
      const projectNm = join(projectDir, "node_modules");
      await mkdir(join(projectNm, "@qawolf"), { recursive: true });
      await writeFile(join(projectNm, "@qawolf", "flows.txt"), "project-copy");

      const flowFile = join(projectDir, "flow.ts");
      await writeFile(flowFile, "// flow");

      const result = await prepareRunDir({
        files: [flowFile],
        projectDir,
        depsRoot,
        runRoot,
      });
      tmpDirs.push(result.runDir);

      // Inner hop is a real directory; @qawolf/flows symlinks into the managed tree
      const innerHop = join(result.runDir, "exec", "node_modules");
      expect((await lstat(innerHop)).isDirectory()).toBe(true);
      expect(await readlink(join(innerHop, "@qawolf", "flows"))).toBe(
        join(depsRoot, "node_modules", "@qawolf", "flows"),
      );

      // Outer hop remains a symlink to the project node_modules
      const outerHop = join(result.runDir, "node_modules");
      expect((await lstat(outerHop)).isSymbolicLink()).toBe(true);
      expect(await readlink(outerHop)).toBe(projectNm);
    });
  });
});
