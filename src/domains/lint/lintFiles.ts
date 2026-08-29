import { dirname, join, resolve } from "node:path";

import type { WorkflowLintMessage } from "@qawolf/workflow-linter";
import { makeLinter } from "@qawolf/workflow-linter/node-bundle";
import {
  createTypescriptProgram,
  resolveImportGraph,
} from "@qawolf/workflow-linter/program";
import { eslintrcJsonPath } from "@qawolf/workflow-linter/team-config";

import { resolveProjectDirSafe } from "~/domains/flows/ensureDeps.js";
import type { Fs } from "~/shell/fs.js";

type LintFileReport =
  | { path: string; messages: WorkflowLintMessage[]; type: "linted" }
  | { path: string; reason: string; type: "unreadable" };

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
  filePaths: string[];
  fs: Fs;
}): Promise<LintReport> {
  const eslintrcJsonText = await readTeamEslintrcJsonText({
    cwd,
    filePaths: filePaths.map((filePath) => resolve(cwd, filePath)),
    fs,
  });
  const files = await Promise.all(
    filePaths.map((path) => lintOneFile({ cwd, eslintrcJsonText, fs, path })),
  );

  const messages = files.flatMap((file) =>
    file.type === "linted" ? file.messages : [],
  );
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
  filePaths: string[];
  fs: Fs;
}): Promise<string | undefined> {
  const projectDir = resolveProjectDirSafe(filePaths, fs);

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
  fs,
  path,
}: {
  cwd: string;
  eslintrcJsonText: string | undefined;
  fs: Fs;
  path: string;
}): Promise<LintFileReport> {
  const absolutePath = resolve(cwd, path);
  if (!(await fs.pathExists(absolutePath)))
    return { path, reason: "no such file", type: "unreadable" };
  if ((await fs.stat(absolutePath)).isDirectory())
    return { path, reason: "is a directory", type: "unreadable" };

  const fileContent = await fs.readFile(absolutePath);
  const resolvedFiles = await resolveImportGraph({
    fileContent,
    fileExists: (importPath) => fs.existsSync(importPath),
    filePath: absolutePath,
    resolveFileContent: async (importPath) =>
      (await fs.pathExists(importPath)) ? fs.readFile(importPath) : undefined,
  });

  const messages = makeLinter({ eslintrcJsonText })
    .verify(fileContent, {
      filename: absolutePath,
      program: createTypescriptProgram(resolvedFiles, absolutePath),
    })
    .filter((message) => message.severity >= 1);

  return { messages, path, type: "linted" };
}
