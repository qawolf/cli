import { createHash } from "node:crypto";
import { basename, dirname, join, sep } from "node:path";

import { copyDirExcluding } from "~/shell/copyDir.js";
import type { Fs } from "~/shell/fs.js";

const excludedDirs = new Set(["node_modules", ".git", ".qawolf"]);

type StageFlowFilesArgs = {
  files: string[];
  projectDir: string | undefined;
  execDir: string;
  fs: Fs;
};

export async function stageFlowFiles(
  args: StageFlowFilesArgs,
): Promise<string[]> {
  const { files, projectDir, execDir, fs } = args;

  if (projectDir !== undefined) {
    await copyDirExcluding(projectDir, execDir, excludedDirs);
    // A file set can span the project and files with no package.json ancestor:
    // resolveProjectDirSafe keeps only the one project dir, so the stragglers
    // are copied in one at a time.
    return Promise.all(
      files.map(
        async (f) =>
          remapPath(f, projectDir, execDir) ?? stageOneFile(f, execDir, fs),
      ),
    );
  }

  if (files.length > 1) {
    return Promise.all(files.map((f) => stageOneFile(f, execDir, fs)));
  }

  // Single file (or empty — validated upstream by buildRunId): flat staging.
  await Promise.all(
    files.map((f) => fs.copyFile(f, join(execDir, basename(f)))),
  );
  return files.map((f) => join(execDir, basename(f)));
}

// Places one file under a subdir keyed by a hash of its source dirname so files
// with identical basenames from different directories do not overwrite each other.
async function stageOneFile(
  file: string,
  execDir: string,
  fs: Fs,
): Promise<string> {
  const dirHash = createHash("sha256")
    .update(dirname(file))
    .digest("hex")
    .slice(0, 8);
  const subDir = join(execDir, dirHash);
  await fs.mkdir(subDir, { recursive: true });
  const dest = join(subDir, basename(file));
  await fs.copyFile(file, dest);
  return dest;
}

// Undefined means the file is not inside projectDir, so the projectDir copy did
// not stage it — returning the source path would run the flow unstaged.
function remapPath(
  file: string,
  projectDir: string,
  execDir: string,
): string | undefined {
  if (file === projectDir) return execDir;
  if (file.startsWith(projectDir + sep)) {
    return join(execDir, file.slice(projectDir.length + 1));
  }
  return undefined;
}
