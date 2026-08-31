import { dirname, join, relative } from "node:path";

import type { WorkflowLintMessage } from "@qawolf/workflow-linter";
import { makeLinter } from "@qawolf/workflow-linter/node-bundle";
import {
  createTypescriptProgram,
  resolveImportGraph,
} from "@qawolf/workflow-linter/program";
import { eslintrcJsonPath } from "@qawolf/workflow-linter/team-config";

import { resolveProjectDirSafe } from "~/domains/flows/ensureDeps.js";
import type { Fs } from "~/shell/fs.js";

type LintFileReport = { messages: WorkflowLintMessage[]; path: string };

export type LintReport = {
  errorCount: number;
  files: LintFileReport[];
  warningCount: number;
};

export async function lintFiles({
  cwd,
  filePaths,
  fs,
}: {
  cwd: string;
  filePaths: readonly string[];
  fs: Fs;
}): Promise<LintReport> {
  const eslintrcJsonText = await readTeamEslintrcJsonText({
    cwd,
    filePaths,
    fs,
  });
  const files = await Promise.all(
    filePaths.map((filePath) =>
      lintOneFile({ cwd, eslintrcJsonText, filePath, fs }),
    ),
  );

  const messages = files.flatMap((file) => file.messages);
  const errorCount = messages.filter(
    (message) => message.severity === 2,
  ).length;
  return { errorCount, files, warningCount: messages.length - errorCount };
}

async function readTeamEslintrcJsonText({
  cwd,
  filePaths,
  fs,
}: {
  cwd: string;
  filePaths: readonly string[];
  fs: Fs;
}): Promise<string | undefined> {
  const projectDir = resolveProjectDirSafe([...filePaths], fs);

  let directory = cwd;
  while (true) {
    const candidate = join(directory, eslintrcJsonPath);
    if (await fs.pathExists(candidate)) return fs.readFile(candidate);

    const parent = dirname(directory);
    const isOutermostSearchedDirectory =
      directory === projectDir ||
      parent === directory ||
      fs.existsSync(join(directory, ".git"));
    if (isOutermostSearchedDirectory) return undefined;
    directory = parent;
  }
}

async function lintOneFile({
  cwd,
  eslintrcJsonText,
  filePath,
  fs,
}: {
  cwd: string;
  eslintrcJsonText: string | undefined;
  filePath: string;
  fs: Fs;
}): Promise<LintFileReport> {
  const fileContent = await fs.readFile(filePath);
  const resolvedFiles = await resolveImportGraph({
    fileContent,
    fileExists: (importPath) => fs.existsSync(importPath),
    filePath,
    resolveFileContent: async (importPath) =>
      (await fs.pathExists(importPath)) ? fs.readFile(importPath) : undefined,
  });

  const messages = makeLinter({ eslintrcJsonText })
    .verify(fileContent, {
      filename: filePath,
      program: createTypescriptProgram(resolvedFiles, filePath),
    })
    .filter((message) => message.severity >= 1);

  return { messages, path: relative(cwd, filePath) };
}
