// oxlint-disable eslint/max-lines -- helper functions are colocated for validate-then-trust walk logic
import { type Stats } from "node:fs";
import { lstat } from "node:fs/promises";
import { dirname, join } from "node:path";

import { type Fs } from "~/shell/fs.js";

import { spawnNpmInstall, type SpawnInstallResult } from "./npmInstall.js";
import { pinnedPackages } from "./pinnedPackages.js";
import { createDirSymlink } from "./symlinkDir.js";

const executorPackageNames = new Set(pinnedPackages.map((p) => p.name));

export type RejectedCandidate = { dir: string; missing: string[] };

export type OuterHopResult =
  | { mode: "symlink"; nodeModulesDir: string }
  | { mode: "install"; depCount: number; rejected: RejectedCandidate[] }
  | { mode: "none" };

export type PopulateOuterHopArgs = {
  projectDir: string | undefined;
  runDir: string;
  fs: Fs;
  // Fires just before the fallback npm install so callers can render a status line.
  onInstallStart?: (depCount: number) => void;
  // Injection point for tests; defaults to spawnNpmInstall.
  install?: (cwd: string) => Promise<SpawnInstallResult>;
};

/**
 * Populates the outer hop (`runDir/node_modules`) with the project's own
 * dependencies so flow files can resolve non-executor packages. Executor
 * packages are stripped to ensure the inner hop always wins for those.
 *
 * Walks up from projectDir for a `node_modules` that satisfies every
 * installable declared dependency (validate-then-trust): candidates missing a
 * dep are recorded and skipped so an unrelated ancestor tree — e.g. a repo the
 * project happens to be nested in — is never symlinked. Falls back to
 * installing the declared deps when no candidate satisfies them. No-ops when
 * `projectDir` is undefined or there is nothing to link or install.
 */
export async function populateOuterHop(
  args: PopulateOuterHopArgs,
): Promise<OuterHopResult> {
  const { projectDir, runDir, fs } = args;
  if (projectDir === undefined) return { mode: "none" };

  const installableDeps = await readInstallableDeps(projectDir, fs);
  const depNames = Object.keys(installableDeps);

  const { satisfying, rejected } = await findSatisfyingNodeModulesDir(
    projectDir,
    depNames,
    fs,
  );
  if (satisfying !== undefined) {
    await createDirSymlink(satisfying, join(runDir, "node_modules"));
    return { mode: "symlink", nodeModulesDir: satisfying };
  }

  if (depNames.length === 0) return { mode: "none" };

  args.onInstallStart?.(depNames.length);
  await installOuterDeps(
    runDir,
    installableDeps,
    fs,
    args.install ?? spawnNpmInstall,
  );
  return { mode: "install", depCount: depNames.length, rejected };
}

type CandidateSearch = {
  satisfying: string | undefined;
  rejected: RejectedCandidate[];
};

/**
 * Walks up from `startDir` collecting real (non-symlink) `node_modules`
 * candidates. Returns the first one containing every name in `depNames`;
 * candidates missing a dep are recorded in `rejected` and the walk continues.
 */
async function findSatisfyingNodeModulesDir(
  startDir: string,
  depNames: string[],
  fs: Fs,
): Promise<CandidateSearch> {
  const rejected: RejectedCandidate[] = [];
  let dir = startDir;
  while (true) {
    const candidate = join(dir, "node_modules");
    const stats = await lstatSafe(candidate);
    if (stats !== undefined && stats.isDirectory() && !stats.isSymbolicLink()) {
      const missing = depNames.filter(
        (name) => !fs.existsSync(join(candidate, name, "package.json")),
      );
      if (missing.length === 0) return { satisfying: candidate, rejected };
      rejected.push({ dir: candidate, missing });
    }
    const parent = dirname(dir);
    if (parent === dir) return { satisfying: undefined, rejected };
    dir = parent;
  }
}

async function lstatSafe(path: string): Promise<Stats | undefined> {
  try {
    return await lstat(path);
  } catch {
    return undefined;
  }
}

async function readInstallableDeps(
  projectDir: string,
  fs: Fs,
): Promise<Record<string, string>> {
  let content: string;
  try {
    content = await fs.readFile(join(projectDir, "package.json"));
  } catch {
    return {};
  }

  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== "object" || parsed === null) return {};

  const rawDeps = (parsed as Record<string, unknown>)["dependencies"];
  if (typeof rawDeps !== "object" || rawDeps === null) return {};

  return Object.fromEntries(
    Object.entries(rawDeps as Record<string, unknown>)
      .filter(([name]) => !executorPackageNames.has(name))
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
  );
}

async function installOuterDeps(
  runDir: string,
  deps: Record<string, string>,
  fs: Fs,
  install: (cwd: string) => Promise<SpawnInstallResult>,
): Promise<void> {
  await fs.writeFile(
    join(runDir, "package.json"),
    JSON.stringify(
      { name: "qawolf-run", private: true, dependencies: deps },
      undefined,
      2,
    ),
  );
  await fs.writeFile(
    join(runDir, ".npmrc"),
    "@qawolf:registry=https://registry.npmjs.org/\n",
  );

  const result = await install(runDir);
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to install project dependencies into ${runDir}: ${result.stderr.trim()}`,
    );
  }
}
