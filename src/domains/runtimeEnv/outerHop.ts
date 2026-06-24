import { type Stats } from "node:fs";
import { lstat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";

import { type Fs } from "~/shell/fs.js";

import { pinnedPackages } from "./pinnedPackages.js";
import { createDirSymlink } from "./symlinkDir.js";

const executorPackageNames = new Set(pinnedPackages.map((p) => p.name));

export type PopulateOuterHopArgs = {
  projectDir: string | undefined;
  runDir: string;
  fs: Fs;
};

/**
 * Populates the outer hop (`runDir/node_modules`) with the project's own
 * dependencies so flow files can resolve non-executor packages. Executor
 * packages are stripped to ensure the inner hop always wins for those.
 * No-ops when `projectDir` is undefined or no installable deps are found.
 */
export async function populateOuterHop(
  args: PopulateOuterHopArgs,
): Promise<void> {
  const { projectDir, runDir, fs } = args;
  if (projectDir === undefined) return;

  const nearestNm = await findNearestNodeModulesDir(projectDir);
  if (nearestNm !== undefined) {
    await createDirSymlink(nearestNm, join(runDir, "node_modules"));
    return;
  }

  const installableDeps = await readInstallableDeps(projectDir, fs);
  if (Object.keys(installableDeps).length > 0) {
    await installOuterDeps(runDir, installableDeps, fs);
  }
}

async function findNearestNodeModulesDir(
  startDir: string,
): Promise<string | undefined> {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, "node_modules");
    const stats = await lstatSafe(candidate);
    if (stats !== undefined && stats.isDirectory() && !stats.isSymbolicLink()) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
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

  const result = await spawnNpmInstall(runDir);
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to install project dependencies into ${runDir}: ${result.stderr.trim()}`,
    );
  }
}

type SpawnInstallResult = { exitCode: number; stderr: string };

function spawnNpmInstall(cwd: string): Promise<SpawnInstallResult> {
  return new Promise((resolvePromise) => {
    const child = spawn("npm", ["install", "--legacy-peer-deps"], { cwd });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += String(chunk);
    });
    child.on("error", (err: Error) =>
      resolvePromise({ exitCode: -1, stderr: stderr || err.message }),
    );
    child.on("close", (code) =>
      resolvePromise({ exitCode: code ?? -1, stderr }),
    );
  });
}
