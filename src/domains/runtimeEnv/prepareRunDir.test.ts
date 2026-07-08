/* eslint-disable eslint/max-lines -- test file for all prepareRunDir scenarios including nested-bundle discovery in Task 3 */
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

import { prepareRunDir } from "./prepareRunDir.js";
import { scaffoldManagedRuntime } from "./scaffoldManagedRuntime.testUtils.js";

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
  await scaffoldManagedRuntime(depsRoot);
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

  describe("outer-hop discovery (nested-bundle topology)", () => {
    it("walks past an unsatisfying host node_modules to a satisfying ancestor", async () => {
      const runRoot = await makeTmpDir();
      const depsRoot = await makeDepsRoot();

      // world/ has the satisfying node_modules; host/ (simulating the CLI repo)
      // has an unrelated one; bundle/ (projectDir) has none of its own.
      const world = await makeTmpDir();
      await mkdir(join(world, "node_modules", "date-fns"), { recursive: true });
      await writeFile(
        join(world, "node_modules", "date-fns", "package.json"),
        `{"name":"date-fns"}`,
      );
      const host = join(world, "host");
      await mkdir(join(host, "node_modules", "lodash"), { recursive: true });
      await writeFile(
        join(host, "node_modules", "lodash", "package.json"),
        `{"name":"lodash"}`,
      );
      const bundle = join(host, "bundle");
      await mkdir(bundle, { recursive: true });
      await writeFile(
        join(bundle, "package.json"),
        JSON.stringify({
          name: "pulled-bundle",
          dependencies: { "date-fns": "2.29.3" },
        }),
      );
      const flowFile = join(bundle, "flow.ts");
      await writeFile(flowFile, "// flow");

      const result = await prepareRunDir({
        files: [flowFile],
        projectDir: bundle,
        depsRoot,
        runRoot,
      });
      tmpDirs.push(result.runDir);

      // The host's node_modules (missing date-fns) must be skipped.
      expect(result.outerHop).toEqual({
        mode: "symlink",
        nodeModulesDir: join(world, "node_modules"),
      });
      expect(await readlink(join(result.runDir, "node_modules"))).toBe(
        join(world, "node_modules"),
      );
    });
  });
});
