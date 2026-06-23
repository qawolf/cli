import { createHash } from "node:crypto";
import { join, resolve, sep } from "node:path";

import { copyDirExcluding } from "~/shell/copyDir.js";
import { makeDefaultFs, type Fs } from "~/shell/fs.js";

type StageFlowsArgs = {
  files: string[];
  projectDir: string | undefined;
  cwd: string;
  fs?: Fs;
};

type StageFlowsResult = {
  files: string[];
  bundleRoot: string | undefined;
  // Removes the staged copy. Present only when this call created one; callers
  // run it after the flows finish (and register it for interrupt cleanup).
  cleanup?: () => Promise<void>;
};

const excludedDirs = new Set(["node_modules", ".git", ".qawolf"]);

/**
 * Prepares a flow bundle root that a `node_modules` symlink can be written into
 * without polluting the user's project. Flows already living under a CLI-managed
 * `.qawolf` dir are used in place; a raw in-place project is copied into
 * `<cwd>/.qawolf/.local/<hash>` (excluding node_modules/.git/.qawolf) and its
 * flow paths remapped onto the staged copy. Returns the staged files plus the
 * bundle root the symlink should target, or `undefined` when there is no project
 * dir (managed-only fallback).
 */
export async function stageFlows(
  args: StageFlowsArgs,
): Promise<StageFlowsResult> {
  const { files, projectDir, cwd } = args;
  const fs = args.fs ?? makeDefaultFs();

  if (projectDir === undefined) return { files, bundleRoot: undefined };

  if (isInsideQawolfDir(projectDir)) {
    return { files, bundleRoot: projectDir };
  }

  // The dir is per-run (pid-suffixed) so concurrent `flows run` on the same
  // project never delete each other's active staging tree; the caller removes
  // it when the run ends.
  const stagedDir = join(
    cwd,
    ".qawolf",
    ".local",
    `${hashProjectDir(projectDir)}-${process.pid}`,
  );
  await fs.rm(stagedDir, { recursive: true, force: true });
  await fs.mkdir(stagedDir, { recursive: true });
  await copyDirExcluding(projectDir, stagedDir, excludedDirs);

  const stagedFiles = files.map((f) => remapPath(f, projectDir, stagedDir));
  return {
    files: stagedFiles,
    bundleRoot: stagedDir,
    cleanup: () => fs.rm(stagedDir, { recursive: true, force: true }),
  };
}

function isInsideQawolfDir(dir: string): boolean {
  return dir.split(sep).includes(".qawolf");
}

function hashProjectDir(projectDir: string): string {
  return createHash("sha256")
    .update(resolve(projectDir))
    .digest("hex")
    .slice(0, 16);
}

function remapPath(
  file: string,
  projectDir: string,
  stagedDir: string,
): string {
  if (file === projectDir) return stagedDir;
  if (file.startsWith(projectDir + sep)) {
    return join(stagedDir, file.slice(projectDir.length + 1));
  }
  return file;
}
