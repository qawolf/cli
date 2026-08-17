import { makeTmpDirTracker } from "~/shell/tmpDir.testUtils.js";
import { afterEach, describe, expect, it } from "bun:test";
import { join } from "node:path";

import { makeDefaultFs } from "~/shell/fs.js";

import { populateOuterHop } from "./outerHop.js";
import { pinnedPackages } from "./pinnedPackages.js";
import {
  makeInstallMock,
  makeProjectTree,
  seedNodeModules,
} from "./runDirFixtures.testUtils.js";
import { scaffoldManagedRuntime } from "./scaffoldManagedRuntime.testUtils.js";
import { expectLinkTarget } from "./symlinkDir.testUtils.js";

const tracker = makeTmpDirTracker("qawolf-outerhop-install-test-");

afterEach(() => tracker.cleanup());

describe("populateOuterHop install mode", () => {
  it("falls back to install when no candidate satisfies, recording rejections", async () => {
    const { root, projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3", "@qawolf/flows": "workspace:*" },
      seed: { "": ["lodash"] },
    });
    const depsRoot = await tracker.makeTmpDir();
    await scaffoldManagedRuntime(depsRoot);

    const installStartCounts: number[] = [];
    const installMock = makeInstallMock().mockImplementation(async () => {
      // onInstallStart must fire BEFORE the install runs.
      expect(installStartCounts).toEqual([1]);
      return { exitCode: 0, stderr: "" };
    });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      depsRoot,
      fs: makeDefaultFs(),
      onInstallStart: (depCount) => installStartCounts.push(depCount),
      install: installMock,
    });

    // @qawolf/flows is pinned (inner hop) so only date-fns is installable.
    expect(result).toEqual({
      mode: "install",
      depCount: 1,
      rejected: [{ dir: join(root, "node_modules"), missing: ["date-fns"] }],
      carriedOver: [],
    });
    expect(installMock).toHaveBeenCalledWith(runDir);

    const written = JSON.parse(
      makeDefaultFs().readFileSync(join(runDir, "package.json")),
    ) as { dependencies: Record<string, string> };
    expect(written.dependencies).toEqual({ "date-fns": "2.29.3" });
  });

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

  it("install mode: symlinks every pinned package from depsRoot into the outer hop", async () => {
    // A project dep (e.g. @qawolf/pom) may peer-depend on pinned executor
    // packages. npm install --legacy-peer-deps never installs peers, and the
    // inner hop is unreachable from runDir/node_modules — so the outer hop must
    // carry its own links to the pinned packages.
    const { projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3" },
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

    expect(result.mode).toBe("install");
    for (const { name } of pinnedPackages) {
      const segments = name.split("/");
      await expectLinkTarget(
        join(runDir, "node_modules", ...segments),
        join(depsRoot, "node_modules", ...segments),
      );
    }
  });

  it("install mode: replaces an npm-installed copy of a pinned package with the pinned link", async () => {
    // A project dep may declare @qawolf/flows as a regular (non-peer) dependency,
    // so npm installs a real copy into the outer hop. Prefer-pinned: the managed
    // copy must win so the run uses a single executor instance.
    const { projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3" },
    });
    const depsRoot = await tracker.makeTmpDir();
    await scaffoldManagedRuntime(depsRoot);

    const installMock = makeInstallMock().mockImplementation(async (cwd) => {
      await seedNodeModules(cwd, ["@qawolf/flows"]);
      return { exitCode: 0, stderr: "" };
    });

    await populateOuterHop({
      projectDir,
      runDir,
      depsRoot,
      fs: makeDefaultFs(),
      install: installMock,
    });

    await expectLinkTarget(
      join(runDir, "node_modules", "@qawolf", "flows"),
      join(depsRoot, "node_modules", "@qawolf", "flows"),
    );
  });

  it("symlink mode: never injects pinned links into the project's own node_modules", async () => {
    const { projectDir, runDir } = await makeProjectTree({
      tracker,
      deps: { "date-fns": "2.29.3" },
      seed: { project: ["date-fns"] },
    });
    const depsRoot = await tracker.makeTmpDir();
    await scaffoldManagedRuntime(depsRoot);

    const result = await populateOuterHop({
      projectDir,
      runDir,
      depsRoot,
      fs: makeDefaultFs(),
    });

    expect(result.mode).toBe("symlink");
    const fs = makeDefaultFs();
    for (const { name } of pinnedPackages) {
      const segments = name.split("/");
      expect(fs.existsSync(join(projectDir, "node_modules", ...segments))).toBe(
        false,
      );
    }
  });
});
