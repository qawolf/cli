import { createHash } from "node:crypto";
import { basename, dirname, join, resolve, sep } from "node:path";

import { copyDirExcluding } from "~/shell/copyDir.js";
import { type Fs, makeDefaultFs } from "~/shell/fs.js";

import { populateOuterHop } from "./outerHop.js";
import { createDirSymlink } from "./symlinkDir.js";

const excludedDirs = new Set(["node_modules", ".git", ".qawolf"]);

export type PrepareRunDirArgs = {
  files: string[];
  projectDir: string | undefined;
  depsRoot: string;
  runRoot: string;
  // Pass a custom Fs for testing file operations; defaults to the real fs.
  fs?: Fs;
};

export type PrepareRunDirResult = {
  files: string[];
  runDir: string;
  cleanup: () => Promise<void>;
};

/**
 * Builds a per-run layered node_modules directory so a flow resolves the
 * CLI-owned executor from a pinned inner hop (`exec/node_modules`) and the
 * flow's own project dependencies from an outer hop (`runDir/node_modules`),
 * with the executor always winning over any project copy (prefer-pinned).
 */
export async function prepareRunDir(
  args: PrepareRunDirArgs,
): Promise<PrepareRunDirResult> {
  const { files, projectDir, depsRoot, runRoot } = args;
  const fs = args.fs ?? makeDefaultFs();

  const runId = buildRunId(projectDir, files);
  const runDir = join(runRoot, runId);

  await fs.rm(runDir, { recursive: true, force: true });
  await fs.mkdir(runDir, { recursive: true });

  const execDir = join(runDir, "exec");
  await fs.mkdir(execDir, { recursive: true });

  // Inner hop: executor deps (playwright, @qawolf/flows, etc.) resolve from here.
  await createDirSymlink(
    join(depsRoot, "node_modules"),
    join(execDir, "node_modules"),
  );

  const stagedFiles = await stageFlowFiles({ files, projectDir, execDir, fs });

  await populateOuterHop({ projectDir, runDir, fs });

  return {
    files: stagedFiles,
    runDir,
    cleanup: () => fs.rm(runDir, { recursive: true, force: true }),
  };
}

function buildRunId(projectDir: string | undefined, files: string[]): string {
  const seedPath = projectDir ?? files[0];
  if (seedPath === undefined) {
    throw new Error(
      "prepareRunDir: files must be non-empty when projectDir is undefined",
    );
  }
  const hash = createHash("sha256")
    .update(resolve(seedPath))
    .digest("hex")
    .slice(0, 16);
  // The pid suffix scopes the runDir to this process invocation; each command
  // calls prepareRunDir once, so same-seedPath reuse within a process is intentional.
  return `${hash}-${process.pid}`;
}

type StageFlowFilesArgs = {
  files: string[];
  projectDir: string | undefined;
  execDir: string;
  fs: Fs;
};

async function stageFlowFiles(args: StageFlowFilesArgs): Promise<string[]> {
  const { files, projectDir, execDir, fs } = args;

  if (projectDir !== undefined) {
    await copyDirExcluding(projectDir, execDir, excludedDirs);
    return files.map((f) => remapPath(f, projectDir, execDir));
  }

  if (files.length > 1) {
    // Multiple files: place each under a subdir keyed by a hash of its source
    // dirname so files with identical basenames from different directories do
    // not overwrite each other.
    return Promise.all(
      files.map(async (f) => {
        const dirHash = createHash("sha256")
          .update(dirname(f))
          .digest("hex")
          .slice(0, 8);
        const subDir = join(execDir, dirHash);
        await fs.mkdir(subDir, { recursive: true });
        const dest = join(subDir, basename(f));
        await fs.copyFile(f, dest);
        return dest;
      }),
    );
  }

  // Single file (or empty — validated upstream by buildRunId): flat staging.
  await Promise.all(
    files.map((f) => fs.copyFile(f, join(execDir, basename(f)))),
  );
  return files.map((f) => join(execDir, basename(f)));
}

function remapPath(file: string, projectDir: string, execDir: string): string {
  if (file === projectDir) return execDir;
  if (file.startsWith(projectDir + sep)) {
    return join(execDir, file.slice(projectDir.length + 1));
  }
  return file;
}
