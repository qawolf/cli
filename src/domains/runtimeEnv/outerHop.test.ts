// oxlint-disable eslint/max-lines -- test file covers all candidate-validation scenarios; splitting would fragment coverage
import { afterEach, describe, expect, it, mock } from "bun:test";
import { realpathSync } from "node:fs";
import { mkdir, mkdtemp, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { makeDefaultFs } from "~/shell/fs.js";

import { populateOuterHop } from "./outerHop.js";

const tmpDirs: string[] = [];

afterEach(async () => {
  mock.restore();
  await Promise.all(
    tmpDirs.map((d) => rm(d, { recursive: true, force: true })),
  );
  tmpDirs.length = 0;
});

async function makeTmpDir(): Promise<string> {
  const d = realpathSync(
    await mkdtemp(join(tmpdir(), "qawolf-outerhop-test-")),
  );
  tmpDirs.push(d);
  return d;
}

// Writes <base>/node_modules/<name>/package.json for each package name.
async function seedNodeModules(base: string, names: string[]): Promise<void> {
  for (const name of names) {
    const pkgDir = join(base, "node_modules", name);
    await mkdir(pkgDir, { recursive: true });
    await writeFile(join(pkgDir, "package.json"), `{"name":"${name}"}`);
  }
}

async function writePackageJson(
  dir: string,
  dependencies: Record<string, string>,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ name: "flows-project", dependencies }),
  );
}

const installMock =
  mock<(cwd: string) => Promise<{ exitCode: number; stderr: string }>>();

describe("populateOuterHop", () => {
  it("symlinks the nearest node_modules when it satisfies declared deps", async () => {
    const root = await makeTmpDir();
    const projectDir = join(root, "project");
    await writePackageJson(projectDir, { "date-fns": "2.29.3" });
    await seedNodeModules(projectDir, ["date-fns"]);
    const runDir = join(root, "run");
    await mkdir(runDir, { recursive: true });

    const result = await populateOuterHop({
      projectDir,
      runDir,
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
    const root = await makeTmpDir();
    // ancestor (satisfies) > mid (does not) > project (no node_modules)
    await seedNodeModules(root, ["date-fns"]);
    const mid = join(root, "mid");
    await seedNodeModules(mid, ["lodash"]);
    const projectDir = join(mid, "project");
    await writePackageJson(projectDir, { "date-fns": "2.29.3" });
    const runDir = join(root, "run");
    await mkdir(runDir, { recursive: true });

    const result = await populateOuterHop({
      projectDir,
      runDir,
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

  it("falls back to install when no candidate satisfies, recording rejections", async () => {
    const root = await makeTmpDir();
    await seedNodeModules(root, ["lodash"]);
    const projectDir = join(root, "project");
    await writePackageJson(projectDir, {
      "date-fns": "2.29.3",
      "@qawolf/flows": "workspace:*",
    });
    const runDir = join(root, "run");
    await mkdir(runDir, { recursive: true });

    const installStartCounts: number[] = [];
    installMock.mockImplementation(async () => {
      // onInstallStart must fire BEFORE the install runs.
      expect(installStartCounts).toEqual([1]);
      return { exitCode: 0, stderr: "" };
    });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      fs: makeDefaultFs(),
      onInstallStart: (depCount) => installStartCounts.push(depCount),
      install: installMock,
    });

    // @qawolf/flows is pinned (inner hop) so only date-fns is installable.
    expect(result).toEqual({
      mode: "install",
      depCount: 1,
      rejected: [{ dir: join(root, "node_modules"), missing: ["date-fns"] }],
    });
    expect(installMock).toHaveBeenCalledWith(runDir);

    const written = JSON.parse(
      makeDefaultFs().readFileSync(join(runDir, "package.json")),
    ) as { dependencies: Record<string, string> };
    expect(written.dependencies).toEqual({ "date-fns": "2.29.3" });
  });

  it("symlinks the nearest node_modules when the project declares no installable deps", async () => {
    const root = await makeTmpDir();
    await seedNodeModules(root, ["lodash"]);
    const projectDir = join(root, "project");
    await writePackageJson(projectDir, { "@qawolf/flows": "workspace:*" });
    const runDir = join(root, "run");
    await mkdir(runDir, { recursive: true });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      fs: makeDefaultFs(),
    });

    expect(result).toEqual({
      mode: "symlink",
      nodeModulesDir: join(root, "node_modules"),
    });
  });

  it("does not disqualify a candidate for lacking pinned executor packages", async () => {
    const root = await makeTmpDir();
    const projectDir = join(root, "project");
    await writePackageJson(projectDir, {
      "date-fns": "2.29.3",
      "@qawolf/flows": "workspace:*",
    });
    // Candidate has date-fns but NOT @qawolf/flows — must still pass.
    await seedNodeModules(projectDir, ["date-fns"]);
    const runDir = join(root, "run");
    await mkdir(runDir, { recursive: true });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      fs: makeDefaultFs(),
    });

    expect(result).toEqual({
      mode: "symlink",
      nodeModulesDir: join(projectDir, "node_modules"),
    });
  });

  it("symlinks the hoisted workspace-root node_modules for a monorepo package", async () => {
    const root = await makeTmpDir();
    // Monorepo shape: deps hoisted to repo root; the workspace package has no
    // node_modules of its own.
    const repo = join(root, "repo");
    await seedNodeModules(repo, ["date-fns"]);
    const projectDir = join(repo, "packages", "flows");
    await writePackageJson(projectDir, { "date-fns": "2.29.3" });
    const runDir = join(root, "run");
    await mkdir(runDir, { recursive: true });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      fs: makeDefaultFs(),
    });

    expect(result).toEqual({
      mode: "symlink",
      nodeModulesDir: join(repo, "node_modules"),
    });
    expect(await readlink(join(runDir, "node_modules"))).toBe(
      join(repo, "node_modules"),
    );
  });

  it("split hoisting: skips a partial package-level node_modules for the satisfying root", async () => {
    const root = await makeTmpDir();
    // npm nests a package-level node_modules on version conflict; the rest of
    // the deps stay hoisted at the repo root.
    const repo = join(root, "repo");
    await seedNodeModules(repo, ["date-fns", "lodash"]);
    const projectDir = join(repo, "packages", "flows");
    await writePackageJson(projectDir, {
      "date-fns": "2.29.3",
      lodash: "3.10.1",
    });
    await seedNodeModules(projectDir, ["lodash"]);
    const runDir = join(root, "run");
    await mkdir(runDir, { recursive: true });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      fs: makeDefaultFs(),
    });

    // The partial package-level candidate (missing date-fns) must be skipped.
    expect(result).toEqual({
      mode: "symlink",
      nodeModulesDir: join(repo, "node_modules"),
    });
  });

  it("returns none when projectDir is undefined", async () => {
    const root = await makeTmpDir();
    const runDir = join(root, "run");
    await mkdir(runDir, { recursive: true });

    const result = await populateOuterHop({
      projectDir: undefined,
      runDir,
      fs: makeDefaultFs(),
    });

    expect(result).toEqual({ mode: "none" });
  });

  it("symlinks the nearest node_modules when package.json contains invalid JSON", async () => {
    const root = await makeTmpDir();
    const projectDir = join(root, "project");
    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, "package.json"), "{not json");
    await seedNodeModules(root, ["lodash"]);
    const runDir = join(root, "run");
    await mkdir(runDir, { recursive: true });

    const result = await populateOuterHop({
      projectDir,
      runDir,
      fs: makeDefaultFs(),
    });

    expect(result).toEqual({
      mode: "symlink",
      nodeModulesDir: join(root, "node_modules"),
    });
  });
});
