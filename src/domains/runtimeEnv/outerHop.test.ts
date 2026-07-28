import { afterEach, describe, expect, it } from "bun:test";
import { readlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { makeDefaultFs } from "~/shell/fs.js";

import { populateOuterHop } from "./outerHop.js";
import {
  makeInstallMock,
  makeProjectTree,
  makeTmpDirTracker,
} from "./runDirFixtures.testUtils.js";
import { scaffoldManagedRuntime } from "./scaffoldManagedRuntime.testUtils.js";

const tracker = makeTmpDirTracker("qawolf-outerhop-test-");

// Pinned links are only created in install mode; symlink/none-mode tests never
// dereference depsRoot, so a sentinel keeps that explicit.
const unusedDepsRoot = "/unused-deps-root";

afterEach(() => tracker.cleanup());

describe("populateOuterHop", () => {
  it("symlinks the nearest node_modules when it satisfies declared deps", async () => {
    const { projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3" },
      seed: { project: ["date-fns"] },
    });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      depsRoot: unusedDepsRoot,
      fs: makeDefaultFs(),
    });

    expect(result).toEqual({
      mode: "symlink",
      nodeModulesDir: join(projectDir, "node_modules"),
    });
    expect(await readlink(join(runDir, "node_modules"))).toBe(
      join(projectDir, "node_modules"),
    );
  });

  it("skips an unsatisfying nearer node_modules and symlinks a satisfying ancestor", async () => {
    // ancestor (satisfies) > mid (does not) > project (no node_modules)
    const { root, projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3" },
      projectPath: "mid/project",
      seed: { "": ["date-fns"], mid: ["lodash"] },
    });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      depsRoot: unusedDepsRoot,
      fs: makeDefaultFs(),
    });

    expect(result).toEqual({
      mode: "symlink",
      nodeModulesDir: join(root, "node_modules"),
    });
    expect(await readlink(join(runDir, "node_modules"))).toBe(
      join(root, "node_modules"),
    );
  });

  it("symlinks the nearest node_modules when the project declares no installable deps", async () => {
    const { root, projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "@qawolf/flows": "workspace:*" },
      seed: { "": ["lodash"] },
    });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      depsRoot: unusedDepsRoot,
      fs: makeDefaultFs(),
    });

    expect(result).toEqual({
      mode: "symlink",
      nodeModulesDir: join(root, "node_modules"),
    });
  });

  it("does not disqualify a candidate for lacking pinned executor packages", async () => {
    // Candidate has date-fns but NOT @qawolf/flows — must still pass.
    const { projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3", "@qawolf/flows": "workspace:*" },
      seed: { project: ["date-fns"] },
    });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      depsRoot: unusedDepsRoot,
      fs: makeDefaultFs(),
    });

    expect(result).toEqual({
      mode: "symlink",
      nodeModulesDir: join(projectDir, "node_modules"),
    });
  });

  it("symlinks the hoisted workspace-root node_modules for a monorepo package", async () => {
    // Monorepo shape: deps hoisted to repo root; the workspace package has no
    // node_modules of its own.
    const { root, projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3" },
      projectPath: "repo/packages/flows",
      seed: { repo: ["date-fns"] },
    });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      depsRoot: unusedDepsRoot,
      fs: makeDefaultFs(),
    });

    expect(result).toEqual({
      mode: "symlink",
      nodeModulesDir: join(root, "repo", "node_modules"),
    });
    expect(await readlink(join(runDir, "node_modules"))).toBe(
      join(root, "repo", "node_modules"),
    );
  });

  it("split hoisting: skips a partial package-level node_modules for the satisfying root", async () => {
    // npm nests a package-level node_modules on version conflict; the rest of
    // the deps stay hoisted at the repo root.
    const { root, projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3", lodash: "3.10.1" },
      projectPath: "repo/packages/flows",
      seed: { repo: ["date-fns", "lodash"], "repo/packages/flows": ["lodash"] },
    });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      depsRoot: unusedDepsRoot,
      fs: makeDefaultFs(),
    });

    // The partial package-level candidate (missing date-fns) must be skipped.
    expect(result).toEqual({
      mode: "symlink",
      nodeModulesDir: join(root, "repo", "node_modules"),
    });
  });

  it("returns none when projectDir is undefined", async () => {
    const { runDir } = await makeProjectTree({ tracker });

    const result = await populateOuterHop({
      projectDir: undefined,
      runDir,
      depsRoot: unusedDepsRoot,
      fs: makeDefaultFs(),
    });

    expect(result).toEqual({ mode: "none" });
  });

  it("never consults a sibling directory's node_modules (multi-repo layout)", async () => {
    // The sibling repo's node_modules WOULD satisfy the project's deps — but
    // it is not an ancestor of the project, so discovery must never see it.
    const { root, projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3" },
      projectPath: "flows-repo",
      seed: { "sibling-repo": ["date-fns"] },
    });

    const depsRoot = await tracker.makeTmpDir();
    await scaffoldManagedRuntime(depsRoot);

    const installMock = makeInstallMock().mockImplementation(async () => ({
      exitCode: 0,
      stderr: "",
    }));

    const result = await populateOuterHop({
      projectDir,
      runDir,
      depsRoot,
      fs: makeDefaultFs(),
      install: installMock,
    });

    // No ancestor satisfies → install; the sibling is invisible to the walk.
    expect(result.mode).toBe("install");
    if (result.mode === "install") {
      expect(result.rejected.map((r) => r.dir)).not.toContain(
        join(root, "sibling-repo", "node_modules"),
      );
    }
    expect(installMock).toHaveBeenCalledWith(runDir);
  });

  it("symlinks the nearest node_modules when package.json contains invalid JSON", async () => {
    const { root, projectDir, runDir } = await makeProjectTree({
      tracker,
      seed: { "": ["lodash"] },
    });
    await writeFile(join(projectDir, "package.json"), "{not json");

    const result = await populateOuterHop({
      projectDir,
      runDir,
      depsRoot: unusedDepsRoot,
      fs: makeDefaultFs(),
    });

    expect(result).toEqual({
      mode: "symlink",
      nodeModulesDir: join(root, "node_modules"),
    });
  });
});
