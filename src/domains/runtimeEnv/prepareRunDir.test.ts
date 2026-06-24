import { afterEach, describe, expect, it } from "bun:test";
import { realpathSync } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
  await mkdir(join(depsRoot, "node_modules"), { recursive: true });
  await writeFile(join(depsRoot, "node_modules", "executor.txt"), "executor");
  return depsRoot;
}

describe("prepareRunDir", () => {
  describe("inner-hop symlink", () => {
    it("symlinks exec/node_modules to depsRoot/node_modules", async () => {
      const runRoot = await makeTmpDir();
      const depsRoot = await makeDepsRoot();
      const srcDir = await makeTmpDir();
      const flowFile = join(srcDir, "flow.ts");
      await writeFile(flowFile, "// flow");

      const result = await prepareRunDir({
        files: [flowFile],
        projectDir: undefined,
        depsRoot,
        runRoot,
      });
      tmpDirs.push(result.runDir);

      const innerHop = join(result.runDir, "exec", "node_modules");
      expect((await lstat(innerHop)).isSymbolicLink()).toBe(true);
      expect(await readlink(innerHop)).toBe(join(depsRoot, "node_modules"));
    });
  });

  describe("outer-hop population", () => {
    it("symlinks runDir/node_modules to the nearest ancestor node_modules when projectDir is given", async () => {
      const runRoot = await makeTmpDir();
      const depsRoot = await makeDepsRoot();

      const projectDir = await makeTmpDir();
      const projectNm = join(projectDir, "node_modules");
      await mkdir(projectNm, { recursive: true });
      await writeFile(join(projectNm, "project-dep.txt"), "project dep");

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
      const srcDir = await makeTmpDir();
      const flowFile1 = join(srcDir, "flow.ts");
      await writeFile(flowFile1, "// flow");

      const result1 = await prepareRunDir({
        files: [flowFile1],
        projectDir: undefined,
        depsRoot,
        runRoot,
      });
      tmpDirs.push(result1.runDir);
      expect(lstat(join(result1.runDir, "node_modules"))).rejects.toThrow();

      // Case 2: projectDir with no node_modules and no package.json deps
      const projectDir = await makeTmpDir();
      const flowFile2 = join(projectDir, "flow.ts");
      await writeFile(flowFile2, "// flow");

      const result2 = await prepareRunDir({
        files: [flowFile2],
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
      const srcDir = await makeTmpDir();
      const flowFile = join(srcDir, "myFlow.ts");
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
      await writeFile(join(projectNm, "pkg.txt"), "pkg");
      const flowFile = join(projectDir, "flow.ts");
      await writeFile(flowFile, "// flow");

      const result = await prepareRunDir({
        files: [flowFile],
        projectDir,
        depsRoot,
        runRoot,
      });
      tmpDirs.push(result.runDir);

      // exec/node_modules should be the inner-hop symlink, not a copy of project nm
      const execNm = join(result.runDir, "exec", "node_modules");
      expect((await lstat(execNm)).isSymbolicLink()).toBe(true);
      expect(await readlink(execNm)).toBe(join(depsRoot, "node_modules"));
    });
  });

  describe("cleanup", () => {
    it("removes the runDir on cleanup()", async () => {
      const runRoot = await makeTmpDir();
      const depsRoot = await makeDepsRoot();
      const srcDir = await makeTmpDir();
      const flowFile = join(srcDir, "flow.ts");
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
      const depsRoot = await makeTmpDir();

      // Inner hop: depsRoot/node_modules has the executor copy
      const innerNm = join(depsRoot, "node_modules");
      await mkdir(join(innerNm, "@qawolf"), { recursive: true });
      await writeFile(join(innerNm, "@qawolf", "flows.txt"), "executor-copy");

      // Outer hop: projectDir/node_modules has a project copy
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

      const innerHop = join(result.runDir, "exec", "node_modules");
      expect(await readlink(innerHop)).toBe(innerNm);

      const outerHop = join(result.runDir, "node_modules");
      expect(await readlink(outerHop)).toBe(projectNm);

      // A flow file under exec/ resolves @qawolf/flows from the inner hop,
      // which is closer in the walk-up than the outer hop.
      const execFlowsFile = join(innerHop, "@qawolf", "flows.txt");
      expect(await readFile(execFlowsFile, "utf-8")).toBe("executor-copy");
    });
  });
});
