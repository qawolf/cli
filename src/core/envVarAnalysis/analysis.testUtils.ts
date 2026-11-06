import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";

import { isFlowFile } from "~/core/flowMeta.js";

import { findEnvAccessors } from "./accessors.js";
import { collectEnvVarsByFlow } from "./callGraph.js";
import type { FlowEnvVars } from "./types.js";

export type AnalysisResult = {
  /** Keyed by the bundle-relative posix path each file was written under. */
  byFlow: Map<string, FlowEnvVars>;
  accessorCount: number;
  cleanup: () => Promise<void>;
};

// Match pull's compiler options without importing the shell layer into core.
const options: ts.CompilerOptions = {
  allowJs: true,
  noEmit: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
};

/** Uses a real program to exercise TypeScript's resolution against a temporary bundle. */
export async function analyse(
  files: Record<string, string>,
): Promise<AnalysisResult> {
  const bundleDir = await mkdtemp(join(tmpdir(), "qawolf-env-analysis-"));
  const sourcePaths: string[] = [];
  for (const [name, contents] of Object.entries(files)) {
    const path = join(bundleDir, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, "utf8");
    if (/\.(ts|js)$/.test(name)) sourcePaths.push(path);
  }

  const program = ts.createProgram(sourcePaths, options);
  const checker = program.getTypeChecker();
  const normalize = (fileName: string): string =>
    fileName.replaceAll("\\", "/");
  const local = new Set(sourcePaths.map(normalize));
  const sourceFiles = program
    .getSourceFiles()
    .filter((file) => local.has(normalize(file.fileName)));
  const accessors = findEnvAccessors(ts, checker, sourceFiles);
  const absolute = collectEnvVarsByFlow({
    compiler: ts,
    checker,
    accessors,
    isLocalFile: (fileName) => local.has(normalize(fileName)),
    flowFiles: sourceFiles.filter((file) => isFlowFile(file.fileName)),
  });

  const byFlow = new Map<string, FlowEnvVars>();
  for (const [fileName, value] of absolute) {
    byFlow.set(
      fileName.slice(bundleDir.length + 1).replaceAll("\\", "/"),
      value,
    );
  }

  return {
    byFlow,
    accessorCount: accessors.size,
    cleanup: () => rm(bundleDir, { recursive: true, force: true }),
  };
}
