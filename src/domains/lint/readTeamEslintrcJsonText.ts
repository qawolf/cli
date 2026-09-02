import { dirname, join } from "node:path";

import { eslintrcJsonPath } from "@qawolf/workflow-linter/team-config";

import type { Fs } from "~/shell/fs.js";

export async function readTeamEslintrcJsonText({
  cwd,
  fs,
  projectDir,
}: {
  cwd: string;
  fs: Fs;
  projectDir: string | undefined;
}): Promise<string | undefined> {
  const outermost = outermostSearchedDirectory({ cwd, fs, projectDir });

  let directory = cwd;
  while (true) {
    const candidate = join(directory, eslintrcJsonPath);
    if (await fs.pathExists(candidate)) return fs.readFile(candidate);

    const parent = dirname(directory);
    if (directory === outermost || parent === directory) return undefined;
    directory = parent;
  }
}

function outermostSearchedDirectory({
  cwd,
  fs,
  projectDir,
}: {
  cwd: string;
  fs: Fs;
  projectDir: string | undefined;
}): string {
  if (projectDir !== undefined) return projectDir;
  return findRepositoryRoot(cwd, fs) ?? cwd;
}

function findRepositoryRoot(cwd: string, fs: Fs): string | undefined {
  let directory = cwd;
  while (true) {
    if (fs.existsSync(join(directory, ".git"))) return directory;
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}
