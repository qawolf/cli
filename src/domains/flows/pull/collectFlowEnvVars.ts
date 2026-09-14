import { relative } from "node:path";

import { findEnvAccessors } from "~/core/envVarAnalysis/accessors.js";
import { collectEnvVarsByFlow } from "~/core/envVarAnalysis/callGraph.js";
import type { FlowEnvVars } from "~/core/envVarAnalysis/types.js";
import { isSourceFile } from "~/core/flowMeta.js";
import { toPosix } from "~/core/repoRelativePath.js";
import { createFlowProgram } from "~/shell/flowProgram.js";
import { makeDefaultFs } from "~/shell/fs.js";
import { walkFiles } from "~/shell/walkFiles.js";

type CollectFlowEnvVarsResult = {
  /** Keyed by bundle-relative posix path, matching the manifest's flow paths. */
  readonly byFlow: ReadonlyMap<string, FlowEnvVars>;
};

// Uses real disk because the compiler loads sources and tsconfig itself.
// Run after applyTeamStorageRewrite so introduced TEAM_STORAGE_DIR reads count.
export async function collectFlowEnvVars(
  bundleDir: string,
): Promise<CollectFlowEnvVarsResult> {
  const sourcePaths = await walkFiles(bundleDir, isSourceFile, makeDefaultFs());
  if (sourcePaths.length === 0) return { byFlow: new Map() };

  const program = await createFlowProgram({ bundleDir, sourcePaths });
  const accessors = findEnvAccessors(
    program.compiler,
    program.checker,
    program.sourceFiles,
  );
  const byAbsolutePath = collectEnvVarsByFlow({
    compiler: program.compiler,
    checker: program.checker,
    accessors,
    isLocalFile: program.isLocalFile,
    flowFiles: program.flowFiles,
  });

  const byFlow = new Map<string, FlowEnvVars>();
  for (const [fileName, value] of byAbsolutePath) {
    byFlow.set(toPosix(relative(bundleDir, fileName)), value);
  }
  return { byFlow };
}
