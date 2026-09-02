import { dirname, extname, join, relative, sep } from "node:path";

import type { WorkflowLintMessage } from "@qawolf/workflow-linter";
import { makeLinter } from "@qawolf/workflow-linter/node-bundle";
import {
  createTypescriptProgram,
  resolveImportGraph,
} from "@qawolf/workflow-linter/program";
import { eslintrcJsonPath } from "@qawolf/workflow-linter/team-config";

import { batchMap, flowBatchSize } from "~/core/batchMap.js";
import type { Fs } from "~/shell/fs.js";

type LintFileReport = { messages: WorkflowLintMessage[]; path: string };

export type LintReport = {
  errorCount: number;
  files: LintFileReport[];
  unreadablePaths: string[];
  warningCount: number;
};

export const lintablePattern = "**/*.{ts,js}";

const lintableExtensions = new Set([".js", ".ts"]);

const generatedDirectoryNames = new Set([
  ".next",
  ".nuxt",
  ".output",
  ".svelte-kit",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "out",
]);

export function selectLintableFiles(
  filePaths: readonly string[],
  cwd: string,
): readonly string[] {
  return filePaths.filter(
    (filePath) =>
      lintableExtensions.has(extname(filePath)) &&
      !isUnderGeneratedDirectory(filePath, cwd),
  );
}

function isUnderGeneratedDirectory(filePath: string, cwd: string): boolean {
  const withinProject = relative(cwd, filePath);
  return withinProject
    .split(sep)
    .slice(0, -1)
    .some((segment) => generatedDirectoryNames.has(segment));
}

export async function lintFiles({
  cwd,
  filePaths,
  fs,
  projectDir,
}: {
  cwd: string;
  filePaths: readonly string[];
  fs: Fs;
  projectDir: string | undefined;
}): Promise<LintReport> {
  const eslintrcJsonText = await readTeamEslintrcJsonText({
    cwd,
    fs,
    projectDir,
  });
  const linter = makeLinter({ eslintrcJsonText });

  const files: LintFileReport[] = [];
  const unreadablePaths: string[] = [];
  const outcomes = batchMap(
    [...filePaths],
    (filePath) => lintOneFile({ cwd, filePath, fs, linter }),
    flowBatchSize,
  );
  for await (const outcome of outcomes) {
    if (outcome.type === "could-not-read") unreadablePaths.push(outcome.path);
    else files.push(outcome.report);
  }

  const messages = files.flatMap((file) => file.messages);
  const errorCount = messages.filter(
    (message) => message.severity === 2,
  ).length;
  return {
    errorCount,
    files,
    unreadablePaths,
    warningCount: messages.length - errorCount,
  };
}

async function readTeamEslintrcJsonText({
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

type LintOneFileOutcome =
  | { path: string; type: "could-not-read" }
  | { report: LintFileReport; type: "linted" };

async function lintOneFile({
  cwd,
  filePath,
  fs,
  linter,
}: {
  cwd: string;
  filePath: string;
  fs: Fs;
  linter: ReturnType<typeof makeLinter>;
}): Promise<LintOneFileOutcome> {
  const path = relative(cwd, filePath);

  const fileContent = await readFileOrUndefined(fs, filePath);
  if (fileContent === undefined) return { path, type: "could-not-read" };

  const resolvedFiles = await resolveImportGraph({
    fileContent,
    fileExists: (importPath) => fs.existsSync(importPath),
    filePath,
    resolveFileContent: (importPath) => readFileOrUndefined(fs, importPath),
  });

  const messages = linter
    .verify(fileContent, {
      filename: filePath,
      program: createTypescriptProgram(resolvedFiles, filePath),
    })
    .filter((message) => message.severity >= 1);

  return { report: { messages, path }, type: "linted" };
}

async function readFileOrUndefined(
  fs: Fs,
  filePath: string,
): Promise<string | undefined> {
  if (!(await fs.pathExists(filePath))) return undefined;
  try {
    return await fs.readFile(filePath);
  } catch {
    return undefined;
  }
}
