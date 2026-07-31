import { createHash } from "node:crypto";
import { basename, dirname, join, sep } from "node:path";

import { copyDirExcluding } from "~/shell/copyDir.js";
import type { Fs } from "~/shell/fs.js";

const excludedDirs = new Set(["node_modules", ".git", ".qawolf"]);

export type StageFlowFilesArgs = {
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
