import { mock } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { TmpDirTracker } from "~/shell/tmpDir.testUtils.js";

/** Writes <base>/node_modules/<name>/package.json for each package name. */
export async function seedNodeModules(
  base: string,
  names: string[],
): Promise<void> {
  for (const name of names) {
    const pkgDir = join(base, "node_modules", name);
    await mkdir(pkgDir, { recursive: true });
    await writeFile(join(pkgDir, "package.json"), `{"name":"${name}"}`);
  }
}

export async function writeProjectPackageJson(
  dir: string,
  dependencies: Record<string, string>,
): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ name: "flows-project", dependencies }),
  );
}

export function makeInstallMock() {
  return mock<(cwd: string) => Promise<{ exitCode: number; stderr: string }>>();
}

export type ProjectTreeArgs = {
  tracker: TmpDirTracker;
  // package.json "dependencies" for the project; omit to skip writing one.
  deps?: Record<string, string>;
  // projectDir path relative to the tree root.
  projectPath?: string;
  // node_modules to seed, keyed by dir relative to the tree root ("" = root).
  seed?: Record<string, string[]>;
};

export type ProjectTree = {
  root: string;
  projectDir: string;
  runDir: string;
};

/** Builds a temp project tree with seeded node_modules and an empty runDir. */
export async function makeProjectTree(
  args: ProjectTreeArgs,
): Promise<ProjectTree> {
  const { tracker, deps, projectPath = "project", seed = {} } = args;
  const root = await tracker.makeTmpDir();
  const projectDir = join(root, projectPath);
  await mkdir(projectDir, { recursive: true });
  if (deps !== undefined) await writeProjectPackageJson(projectDir, deps);
  for (const [rel, names] of Object.entries(seed)) {
    await seedNodeModules(rel === "" ? root : join(root, rel), names);
  }
  const runDir = join(root, "run");
  await mkdir(runDir, { recursive: true });
  return { root, projectDir, runDir };
}
