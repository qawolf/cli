import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

import { type Fs, makeDefaultFs } from "~/shell/fs.js";

import { writeExecSubpathImports } from "./execSubpathImports.js";
import { populateInnerHop } from "./innerHop.js";
import { type OuterHopResult, populateOuterHop } from "./outerHop.js";
import { stageFlowFiles } from "./stageFlowFiles.js";

export type PrepareRunDirArgs = {
  files: string[];
  projectDir: string | undefined;
  depsRoot: string;
  runRoot: string;
  // Pass a custom Fs for testing file operations; defaults to the real fs.
  fs?: Fs;
  // Forwarded to populateOuterHop — fires just before a fallback npm install.
  onInstallStart?: (depCount: number) => void;
};

export type PrepareRunDirResult = {
  files: string[];
  runDir: string;
  outerHop: OuterHopResult;
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

  // Inner hop: only pinned executor packages resolve here — see populateInnerHop.
  await populateInnerHop({ depsRoot, execDir, fs });

  const stagedFiles = await stageFlowFiles({ files, projectDir, execDir, fs });

  // Only the projectDir path copies a package.json into exec; standalone runs
  // stage bare files that never use the "#playwright" alias.
  if (projectDir !== undefined) {
    await writeExecSubpathImports({ execDir, fs });
  }

  const outerHop = await populateOuterHop({
    projectDir,
    runDir,
    depsRoot,
    fs,
    ...(args.onInstallStart !== undefined
      ? { onInstallStart: args.onInstallStart }
      : {}),
  });

  return {
    files: stagedFiles,
    runDir,
    outerHop,
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
