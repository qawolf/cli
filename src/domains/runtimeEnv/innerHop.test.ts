import { afterEach, describe, expect, it } from "bun:test";
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { lstat, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { makeDefaultFs } from "~/shell/fs.js";

import { populateInnerHop } from "./innerHop.js";
import { pinnedPackages } from "./pinnedPackages.js";
import { scaffoldManagedRuntime } from "./scaffoldManagedRuntime.testUtils.js";
import { createDirSymlink } from "./symlinkDir.js";
import { expectLinkTarget } from "./symlinkDir.testUtils.js";

const tmpDirs: string[] = [];

afterEach(async () => {
  // Reverse creation order, one at a time: a later dir can hold a junction into
  // an earlier one, and win32 fails to remove a junction whose target is gone.
  for (const d of [...tmpDirs].reverse()) {
    await rm(d, { recursive: true, force: true });
  }
  tmpDirs.length = 0;
});

async function makeTmpDir(): Promise<string> {
  const d = realpathSync(
    await mkdtemp(join(tmpdir(), "qawolf-innerhop-test-")),
  );
  tmpDirs.push(d);
  return d;
}

describe("populateInnerHop", () => {
  describe("happy path — directory and symlinks", () => {
    it("creates execDir/node_modules as a real directory, not a symlink", async () => {
      const depsRoot = await makeTmpDir();
      const execDir = await makeTmpDir();
      await scaffoldManagedRuntime(depsRoot);

      await populateInnerHop({ depsRoot, execDir, fs: makeDefaultFs() });

      const innerModules = join(execDir, "node_modules");
      const stats = await lstat(innerModules);
      expect(stats.isDirectory()).toBe(true);
      expect(stats.isSymbolicLink()).toBe(false);
    });

    it("creates one symlink per pinned package pointing into the managed tree", async () => {
      const depsRoot = await makeTmpDir();
      const execDir = await makeTmpDir();
      await scaffoldManagedRuntime(depsRoot);

      await populateInnerHop({ depsRoot, execDir, fs: makeDefaultFs() });

      const innerModules = join(execDir, "node_modules");
      const managedModules = join(depsRoot, "node_modules");
      for (const { name } of pinnedPackages) {
        const segments = name.split("/");
        const linkPath = join(innerModules, ...segments);
        await expectLinkTarget(linkPath, join(managedModules, ...segments));
      }
    });

    it("creates the @qawolf scope dir with flows, emails, and testkit symlinks", async () => {
      const depsRoot = await makeTmpDir();
      const execDir = await makeTmpDir();
      await scaffoldManagedRuntime(depsRoot);

      await populateInnerHop({ depsRoot, execDir, fs: makeDefaultFs() });

      const innerModules = join(execDir, "node_modules");
      const managedModules = join(depsRoot, "node_modules");
      const scopeDir = join(innerModules, "@qawolf");
      expect((await lstat(scopeDir)).isDirectory()).toBe(true);

      for (const pkg of ["flows", "emails", "testkit"]) {
        const linkPath = join(scopeDir, pkg);
        await expectLinkTarget(linkPath, join(managedModules, "@qawolf", pkg));
      }
    });
  });

  describe("realpath resolution — transitive dep shadowing fix", () => {
    it("flow gets outer-hop project version; executor probe gets managed pinned version via realpath", async () => {
      const runDir = await makeTmpDir();
      const depsRoot = await makeTmpDir();
      const projectDir = await makeTmpDir();

      // Scaffold all 7 pinned package dirs in the managed runtime
      await scaffoldManagedRuntime(depsRoot);

      // Add a transitive dep "diff" in the managed runtime (executor's hoisted copy)
      const managedNm = join(depsRoot, "node_modules");
      await mkdir(join(managedNm, "diff"), { recursive: true });
      await writeFile(
        join(managedNm, "diff", "package.json"),
        JSON.stringify({ name: "diff", version: "1.0.0-PINNED" }),
      );

      // Place a probe inside the managed @qawolf/flows package that reads diff's version
      const flowsDir = join(managedNm, "@qawolf", "flows");
      await writeFile(
        join(flowsDir, "probe.mjs"),
        [
          "import { createRequire } from 'node:module';",
          "const require = createRequire(import.meta.url);",
          "process.stdout.write(require('diff/package.json').version + '\\n');",
        ].join("\n"),
      );

      // Outer hop: project has a different version of diff
      const projectNm = join(projectDir, "node_modules");
      await mkdir(join(projectNm, "diff"), { recursive: true });
      await writeFile(
        join(projectNm, "diff", "package.json"),
        JSON.stringify({ name: "diff", version: "2.0.0-PROJECT" }),
      );

      // Build the inner hop: real dir with per-package symlinks into managed tree
      const execDir = join(runDir, "exec");
      await mkdir(execDir, { recursive: true });
      await populateInnerHop({ depsRoot, execDir, fs: makeDefaultFs() });

      // Build the outer hop: runDir/node_modules → projectNm
      await createDirSymlink(projectNm, join(runDir, "node_modules"));

      // Stage a flow file in execDir that requires diff
      const flowFile = join(execDir, "flow.mjs");
      await writeFile(
        flowFile,
        [
          "import { createRequire } from 'node:module';",
          "const require = createRequire(import.meta.url);",
          "process.stdout.write(require('diff/package.json').version + '\\n');",
        ].join("\n"),
      );

      // Flow misses the inner hop (diff is not pinned) and falls through to outer hop
      const flowOutput = execFileSync("node", [flowFile], {
        encoding: "utf-8",
      }).trim();
      expect(flowOutput).toBe("2.0.0-PROJECT");

      // Probe inside @qawolf/flows resolves via realpath into the managed tree
      const probeFile = join(
        execDir,
        "node_modules",
        "@qawolf",
        "flows",
        "probe.mjs",
      );
      const probeOutput = execFileSync("node", [probeFile], {
        encoding: "utf-8",
      }).trim();
      expect(probeOutput).toBe("1.0.0-PINNED");
    });
  });
});
