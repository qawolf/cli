import { makeTmpDirTracker } from "~/shell/tmpDir.testUtils.js";
import { afterEach, describe, expect, it } from "bun:test";
import { lstat, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { makeDefaultFs } from "~/shell/fs.js";

import { populateOuterHop } from "./outerHop.js";
import {
  makeInstallMock,
  makeProjectTree,
  seedNodeModules,
} from "./runDirFixtures.testUtils.js";
import { scaffoldManagedRuntime } from "./scaffoldManagedRuntime.testUtils.js";
import { expectLinkTarget } from "./symlinkDir.testUtils.js";

const tracker = makeTmpDirTracker("qawolf-outerhop-carryover-test-");

afterEach(() => tracker.cleanup());

describe("populateOuterHop carry-over", () => {
  it("carries over a package the project has installed but does not declare", async () => {
    // The repro from WIZ-11549: an undeclared package resolves while the whole
    // project node_modules symlinks, then vanishes as soon as one unrelated
    // declared dep goes missing and the fallback install takes over.
    const { projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3", "csv-parser": "3.0.0" },
      seed: { project: ["date-fns", "date-fns-tz"] },
    });
    const depsRoot = await tracker.makeTmpDir();
    await scaffoldManagedRuntime(depsRoot);

    const installMock = makeInstallMock().mockImplementation(async (cwd) => {
      await seedNodeModules(cwd, ["date-fns", "csv-parser"]);
      return { exitCode: 0, stderr: "" };
    });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      depsRoot,
      fs: makeDefaultFs(),
      install: installMock,
    });

    expect(result).toMatchObject({
      mode: "install",
      carriedOver: ["date-fns-tz"],
    });
    await expectLinkTarget(
      join(runDir, "node_modules", "date-fns-tz"),
      join(projectDir, "node_modules", "date-fns-tz"),
    );
  });

  it("leaves an outer-hop entry that has no readable package.json alone", async () => {
    // A broken link or an interrupted install leaves an entry that reads as
    // absent. Carrying over must never overwrite it, nor fail the run.
    const { projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3", "csv-parser": "3.0.0" },
      seed: { project: ["date-fns", "date-fns-tz"] },
    });
    const depsRoot = await tracker.makeTmpDir();
    await scaffoldManagedRuntime(depsRoot);

    const installMock = makeInstallMock().mockImplementation(async (cwd) => {
      await seedNodeModules(cwd, ["date-fns", "csv-parser"]);
      // Present on disk, but not recognizable as a package.
      await mkdir(join(cwd, "node_modules", "date-fns-tz"), {
        recursive: true,
      });
      return { exitCode: 0, stderr: "" };
    });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      depsRoot,
      fs: makeDefaultFs(),
      install: installMock,
    });

    expect(result).toMatchObject({ mode: "install", carriedOver: [] });
    const entry = await lstat(join(runDir, "node_modules", "date-fns-tz"));
    expect(entry.isSymbolicLink()).toBe(false);
  });

  it("never carries a package from an ancestor node_modules", async () => {
    // The ancestor may belong to an unrelated repo the project sits inside.
    const { root, projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3" },
      seed: { "": ["unrelated-ancestor-pkg"] },
    });
    const depsRoot = await tracker.makeTmpDir();
    await scaffoldManagedRuntime(depsRoot);

    const result = await populateOuterHop({
      projectDir,
      runDir,
      depsRoot,
      fs: makeDefaultFs(),
      install: makeInstallMock().mockImplementation(async (cwd) => {
        await seedNodeModules(cwd, ["date-fns"]);
        return { exitCode: 0, stderr: "" };
      }),
    });

    expect(result).toMatchObject({ mode: "install", carriedOver: [] });
    expect(
      makeDefaultFs().existsSync(
        join(runDir, "node_modules", "unrelated-ancestor-pkg"),
      ),
    ).toBe(false);
    expect(makeDefaultFs().existsSync(join(root, "node_modules"))).toBe(true);
  });
});
