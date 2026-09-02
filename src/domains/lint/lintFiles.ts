import { relative } from "node:path";

import type { WorkflowLintMessage } from "@qawolf/workflow-linter";
import { makeLinter } from "@qawolf/workflow-linter/node-bundle";
import {
  createTypescriptProgram,
  resolveImportGraph,
} from "@qawolf/workflow-linter/program";

import { batchMap, flowBatchSize } from "~/core/batchMap.js";
import type { Fs } from "~/shell/fs.js";
import { readTeamEslintrcJsonText } from "./readTeamEslintrcJsonText.js";

type LintFileReport = { messages: WorkflowLintMessage[]; path: string };

export type LintReport = {
  errorCount: number;
  files: LintFileReport[];
  unreadablePaths: string[];
  warningCount: number;
};

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
